import { compareSync } from "bcrypt";
import { type NextFunction, type Response, Router } from "express";
import * as z4 from "zod/v4";
import { ClientError, ServerError } from "../../error";
import { z4Base64File } from "../../helpers";
import { error } from "../../logging";
import { type ExtendedRequest, mdwRequerBody } from "../../middlewares";
import repositorioUsuarios from "../../repository/repositorioUsuarios";
import { hashSenha } from "../../system/auth";
import { ParamsIdSchemaZ, SenhaZ } from "./objects";

export type GetPerfilDto = {
  id: string;
  nome: string;
  descricao: string | null;
  foto: string | null;
};

export type GetPerfilPessoalDto = GetPerfilDto & {
  login: string;
  habilitado: boolean;
  modoEscuro: boolean;
};

export const SetPerfilPessoalDtoZ = z4.strictObject({
  nome: z4.string().min(1).max(32),
  login: z4.string().min(1).max(32),
  foto: z4Base64File.nullable().optional(),
  modoEscuro: z4.boolean().optional(),
});

export type SetPerfilPessoalDto = z4.infer<typeof SetPerfilPessoalDtoZ>;

const AlteracaoSenhaZ = z4.strictObject({
  senhaAnterior: SenhaZ,
  senhaNova: SenhaZ,
});

async function getUsuarioId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioUsuarios.selecionarPorId(id);
    if (registro) {
      /** Seleciona apenas as informações públicas */
      res.json({
        id: registro.id,
        nome: registro.nome,
        descricao: registro.descricao,
        foto: registro.foto as string | null,
      });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

async function alterarSenha(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req._usuario!;
    const senhas = AlteracaoSenhaZ.parse(req.body);
    const usuarioId = usuario.id;
    const { senhaAnterior, senhaNova } = senhas;
    // Verificar se a senha confere
    const registro = await repositorioUsuarios.selecionarPorId(usuarioId);
    if (registro) {
      const passwordCheck = compareSync(senhaAnterior, registro.hashedPassword);
      if (!passwordCheck) {
        error("A senha informada não confere.", { label: "Auth" });
        throw new ClientError("Unauthorized", 401);
      }
      // Realizar hash da nova senha
      const hashedPassword = await hashSenha(senhaNova);
      // Atualizar a senha
      const updates = await repositorioUsuarios.atualizarPorId(usuarioId, {
        hashedPassword,
      });
      if (updates === 1) {
        res.sendStatus(200);
      } else {
        throw new ServerError(
          "Não foi possível substituir a senha do usuário.",
        );
      }
    } else {
      error("Nenhum usuário com o login informado foi encontrado.", {
        label: "Auth",
      });
      res.sendStatus(401);
    }
  } catch (err) {
    next(err);
  }
}

async function patchUsuario(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // INFO: strict() object, wont allow other values (in theory).
    const parsedBody = SetPerfilPessoalDtoZ.parse(req.body);
    const usuarioId = req._usuario!.id;
    const registro = await repositorioUsuarios.selecionarPorId(usuarioId);
    if (registro) {
      await repositorioUsuarios.atualizarPorId(usuarioId, parsedBody);
      // throw new ServerError("Não foi possível atualizar as informações do usuário.");
      res.sendStatus(200);
    } else {
      res.sendStatus(500);
    }
  } catch (err) {
    next(err);
  }
}

const apiV1Perfil = Router();

apiV1Perfil
  .get("/:id", getUsuarioId)
  .post("/alterar-senha", mdwRequerBody, alterarSenha)
  // TODO: Implementar PUT e PATCH para o endpoint de usuários.
  .patch("/", mdwRequerBody, patchUsuario);

export default apiV1Perfil;
