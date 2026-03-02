import type { NextFunction, Request, Response } from "express";
import { customAlphabet } from "nanoid";
import { COOKIE_SESSION_TOKEN, type GetSessaoDto } from "./auth";
import { alfabetoHexadecimal } from "./db/enums/identificador";
import { Permissoes } from "./db/enums/permissoes";
import { ClientError } from "./error";
import { bufferTostring } from "./helpers";
import { error, warning } from "./logging";
import repositorioPermissoes from "./repository/repositorioPermissoes";
import repositorioSessoes from "./repository/repositorioSessoes";
import repositorioUsuarios from "./repository/repositorioUsuarios";
import {
  constantTimeEqual,
  hashSecret,
  parseToken,
  SESSION_EXPIRES_IN_MSECONDS,
} from "./system/auth";

export type Cookies = {
  tokenSessao?: string;
};

export interface ExtendedRequest extends Request {
  /**
   * @deprecated Utilizar _cookies.tokenSessao
   */
  _sessionToken?: string;
  _usuario?: GetSessaoDto;
  _requestId?: string;
  _cookies?: Cookies;
}

function extrairCookies(cookies: unknown): Cookies | null {
  if (!cookies || typeof cookies !== "object") {
    return null;
  }
  const _cookies: Cookies = {};
  if (
    COOKIE_SESSION_TOKEN in cookies &&
    typeof cookies.session_token === "string"
  ) {
    _cookies.tokenSessao = cookies.session_token;
  }
  return _cookies;
}

export function mdwLoadSessionCookies(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    const cookies = extrairCookies(req.cookies);
    if (typeof cookies?.tokenSessao !== "string") {
      res.sendStatus(400);
      return;
    }
    req._cookies = cookies;
    req._sessionToken = cookies.tokenSessao;
    next();
  } catch (err) {
    warning("Usuário não autenticado", { label: "Cookies" });
    next(err);
  }
}

// TODO: Limpar cookies?
// TODO: Criar HttpError401
// TODO: Check for timing attacks
// TODO: Unificar queries
export async function mdwAutenticacao(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cookies = extrairCookies(req.cookies);
    if (typeof cookies?.tokenSessao !== "string") {
      res.sendStatus(401);
      return;
    }
    req._cookies = cookies;
    req._sessionToken = cookies.tokenSessao;
    if (!req._cookies.tokenSessao || req._cookies.tokenSessao.length === 0) {
      warning("Cookies de sessão não encontrados na request.", {
        label: "Session",
      });
      res.sendStatus(401);
      return;
    }

    // consultarSessaoPorToken

    // 1. Verificar o token (id, segredo)
    const token = req._cookies?.tokenSessao;
    const _token = parseToken(token);
    if (!_token) {
      throw new ClientError("Unauthorized", 401);
    }
    const tokenId = _token.id;
    const tokenSecret = _token.secret;
    // 2. Verificar se há uma sessão na base de dados com o id do cookie
    const sessao = await repositorioSessoes.selecionarPorId(tokenId);
    if (!sessao) {
      error("Sessão não encontrada.", { label: "AuthServ" });
      throw new ClientError("Unauthorized", 401);
    }
    const now = new Date();
    // 3. Verificar se a sessão não esta expirada
    if (
      now.getTime() - sessao.createdAt.getTime() >=
      SESSION_EXPIRES_IN_MSECONDS
    ) {
      warning(`Sessão expirada: ${tokenId}`, { label: "AuthServ" });
      await repositorioSessoes.excluirPorId(tokenId);
      throw new ClientError("Unauthorized", 401);
    }
    // 4. Verificar se o segredo da sessão confere
    const tokenSecretHash = await hashSecret(tokenSecret);
    // Node.js only
    // crypto.timingSafeEqual(tokenSecretHash, sessao.secretHash)
    const isValidSession = constantTimeEqual(
      tokenSecretHash,
      sessao.secretHash,
    );
    if (!isValidSession) {
      warning("Sessão inválida", { label: "Session" });
      throw new ClientError("Unauthorized", 401);
    }
    // 5. (sessão valida) Retornar dados do usuário
    const usuario = await repositorioUsuarios.selecionarPorId(sessao.usuarioId);
    if (!usuario) {
      error("Usuário não encontrado.", { label: "AuthServ" });
      throw new ClientError("Unauthorized", 401);
    }
    const registros = await repositorioPermissoes.selecionarPorIdUsuario(
      usuario.id,
    );
    const perms = registros.map((registro) => registro.cargo);
    const usuarioSessao = {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      modoEscuro: usuario.modoEscuro,
      // as string,
      foto: usuario.foto ? bufferTostring(usuario.foto as Uint8Array) : null,
      permissoes: perms,
    };

    // consultarSessaoPorToken

    if (!usuarioSessao) {
      warning("Sessão inválida", {
        label: "Session",
      });
      res.sendStatus(401);
      return;
    }
    req._usuario = usuarioSessao;
    next();
  } catch (err) {
    next(err);
  }
}

export function mdwPermissoes(
  ...perms: Permissoes[]
): (e: ExtendedRequest, res: Response, n: NextFunction) => void {
  return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    try {
      const usuario = req._usuario;
      let permitido = false;
      if (usuario) {
        permitido = perms.reduce(
          (ok, perm) => ok || usuario.permissoes.includes(perm),
          permitido,
        );
      }
      if (permitido) {
        next();
      } else {
        res.sendStatus(401);
        return;
      }
    } catch (err) {
      next(err);
    }
  };
}

const createRequestId = customAlphabet(alfabetoHexadecimal, 4);

export function mdwRequestId(
  req: ExtendedRequest,
  _res: Response,
  next: NextFunction,
): void {
  req._requestId = createRequestId();
  next();
}

export function mdwSemBody(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.body) {
    error("Invalid request with body.", {
      reqId: req._requestId,
    });
    res.sendStatus(400);
  } else {
    next();
  }
}

export function mdwRequerBody(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.body) {
    error("No body.", { reqId: req._requestId });
    res.sendStatus(400);
  } else {
    next();
  }
}
