import { compare } from "bcrypt";
import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import z4 from "zod/v4";
import { Permissoes } from "./db/enums/permissoes";
import { ClientError } from "./error";
import { z4Base64File } from "./helpers";
import { debug, error } from "./logging";
import {
  type ExtendedRequest,
  mdwAutenticacao,
  mdwLoadSessionCookies,
  mdwRequerBody,
  mdwSemBody,
} from "./middlewares";
import repositorioPermissoes from "./repository/repositorioPermissoes";
import repositorioSessoes from "./repository/repositorioSessoes";
import repositorioUsuarios from "./repository/repositorioUsuarios";
import {
  generateSecureRandomString,
  hashSecret,
  parseToken,
} from "./system/auth";

export const COOKIE_SESSION_TOKEN = "session_token";

export const CredenciaisSchemaZ = z4.strictObject({
  login: z4.string(),
  senha: z4.string(),
});

export const GetSessaoDtoZ = z4.strictObject({
  id: z4.string(),
  nome: z4.string(),
  login: z4.string(),
  modoEscuro: z4.boolean(),
  foto: z4Base64File.nullable(),
  permissoes: z4.array(z4.enum(Permissoes)),
});

export type GetSessaoDto = z4.infer<typeof GetSessaoDtoZ>;

// A aplicação ira suportar criação de novos logins apenas por administradores
// POST /auth/login
// POST /auth/logout

/**
 * Retorna informações do usuário da sessão de acordo com o token de sessão.
 */
function sessao(req: ExtendedRequest, res: Response, next: NextFunction): void {
  try {
    const usuario = req._usuario!;
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

/**
 * Recebe login e senha e cria uma nova sessão retornando token e informações
 * do usuário da sessão.
 */
async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedCredenciais = CredenciaisSchemaZ.parse(req.body);
    // if login invalid, this function will return a error
    // else, it will return the token
    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = req.ip || "";
    const login = parsedCredenciais.login;
    const senha = parsedCredenciais.senha;

    // Verificar se existe um usuário com este login
    const usuario = await repositorioUsuarios.selecionarPorLogin(login);
    if (!usuario) {
      error("Nenhum usuário com o login informado foi encontrado.", {
        label: "Auth",
      });
      throw new ClientError("Unauthorized", 401);
    }
    const passwordCheck = await compare(senha, usuario.hashedPassword);
    if (!passwordCheck) {
      error("A senha informada não confere.", { label: "Auth" });
      throw new ClientError("Unauthorized", 401);
    }
    // Criar Sessão
    const id = generateSecureRandomString();
    const secret = generateSecureRandomString();
    const secretHash = await hashSecret(secret);
    const token = `${id}.${secret}`;
    debug(token, { label: "TokenGen" });
    await repositorioSessoes.inserir({
      id,
      secretHash: Buffer.from(secretHash),
      usuarioId: usuario.id,
      userAgent,
      ipAddress,
    });

    const registros = await repositorioPermissoes.selecionarPorIdUsuario(
      usuario.id,
    );
    const perms = registros.map((registro) => registro.cargo);
    const infoSessao = {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        modoEscuro: usuario.modoEscuro,
        foto: usuario.foto as string,
        permissoes: perms,
      },
    };

    res.cookie(COOKIE_SESSION_TOKEN, infoSessao.token, {
      httpOnly: true,
      // TODO: Use when http available or create a DEVELOPMENT env var
      // secure: true,
      // maxAge: 24hours
      maxAge: 86400000,
      path: "/",
      sameSite: "lax",
    });
    res.json(infoSessao.usuario);
  } catch (err) {
    error("Não foi possível realizar o login.", { label: "Auth" });
    next(err);
  }
}

async function logout(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // this function will receive the token, invalidate, and redirect
  try {
    const _sessionToken = req._sessionToken;
    // TODO: Limpar todos os cookies
    res.clearCookie(COOKIE_SESSION_TOKEN);
    if (_sessionToken) {
      const _token = parseToken(_sessionToken);
      if (_token) {
        const sessoes = await repositorioSessoes.selecionarPorId(_token.id);
        if (sessoes) {
          await repositorioSessoes.excluirPorId(_token.id);
        }
      }
    }
    res.redirect("/");
  } catch (err) {
    next(err);
  }
}

async function logoutAll(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // this function will receive the token, invalidate, and redirect
  try {
    const _sessionToken = req._cookies!.tokenSessao;
    // TODO: Limpar todos os cookies
    res.clearCookie(COOKIE_SESSION_TOKEN);
    if (_sessionToken) {
      const _token = parseToken(_sessionToken);
      if (_token) {
        const sessoes = await repositorioSessoes.selecionarPorId(_token.id);
        if (sessoes) {
          await repositorioSessoes.excluirPorUsuarioId(sessoes.usuarioId);
        }
      }
    }
    res.redirect("/");
  } catch (err) {
    next(err);
  }
}

const authRouter = Router();

authRouter
  .get("/sessao", mdwAutenticacao, mdwSemBody, sessao)
  .post("/login", mdwRequerBody, login)
  .post("/logout", mdwLoadSessionCookies, logout)
  .post("/logout-all", mdwLoadSessionCookies, logoutAll)
  // Retornar 404 caso a rota não existe (necessário devido a rota inicial
  // redirecionar para index.html)
  .all(/(.*)/, (_: Request, res: Response) => res.sendStatus(404));

export default authRouter;
