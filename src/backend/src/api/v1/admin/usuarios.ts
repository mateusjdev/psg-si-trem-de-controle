import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import * as z4 from "zod/v4";
import { Permissoes } from "../../../db/enums/permissoes";
import {
  InsertUsuarioSchemaZ,
  type UpdateUsuarioSchema,
} from "../../../db/schema/usuarios";
import { ClientError, ServerError } from "../../../error";
import { bufferTostring, z4Base64File } from "../../../helpers";
import { type ExtendedRequest, mdwRequerBody } from "../../../middlewares";
import repositorioPermissoes from "../../../repository/repositorioPermissoes";
import repositorioUsuarios from "../../../repository/repositorioUsuarios";
import { hashSenha } from "../../../system/auth";
import { ParamsIdSchemaZ, SenhaZ } from "../objects";

export const SetUsuarioDtoZ = z4.strictObject({
  nome: z4.string().min(1).max(32),
  login: z4.string().min(1).max(32),
  senha: SenhaZ,
  descricao: z4.string().max(256).nullable().optional(),
  habilitado: z4.boolean().optional(),
  foto: z4Base64File.nullable().nullish(),
  modoEscuro: z4.boolean().optional().default(false),
  permissoes: z4.array(z4.enum(Permissoes)).optional(),
});

export type SetUsuarioDto = z4.infer<typeof SetUsuarioDtoZ>;

export const UpdateUsuarioDtoZ = z4.strictObject({
  nome: z4.string().min(1).max(32).optional(),
  login: z4.string().min(1).max(32).optional(),
  // TODO: Deprecate (Utilizar alterarSenha)
  senha: SenhaZ.optional(),
  descricao: z4.string().max(256).nullable().optional(),
  habilitado: z4.boolean().optional(),
  modoEscuro: z4.boolean().optional(),
  foto: z4Base64File.nullable().optional(),
});

export type UpdateUsuarioDto = z4.infer<typeof UpdateUsuarioDtoZ>;

async function getUsuarios(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const registros = await repositorioUsuarios.selecionarTodos();
    const consulta = registros.map((registro) => ({
      id: registro.id,
      nome: registro.nome,
      login: registro.login,
      descricao: registro.descricao,
      habilitado: registro.habilitado,
      modoEscuro: registro.modoEscuro,
      foto: registro.foto ? bufferTostring(registro.foto as Uint8Array) : null,
    }));

    res.json(consulta);
  } catch (err) {
    next(err);
  }
}

async function criarUsuario(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedBody = SetUsuarioDtoZ.parse(req.body);
    const { permissoes } = parsedBody;
    // Verifica se login já existe
    const registro = await repositorioUsuarios.selecionarPorLogin(
      parsedBody.login,
    );
    if (registro) {
      throw new ClientError("Login já existe.", 409);
    }
    const hashedPassword = await hashSenha(parsedBody.senha);
    const insertUsuario = InsertUsuarioSchemaZ.parse({
      nome: parsedBody.nome,
      login: parsedBody.login,
      foto: parsedBody.foto,
      descricao: parsedBody.descricao,
      habilitado: parsedBody.habilitado,
      hashedPassword: hashedPassword,
    });

    const usuarioId = await repositorioUsuarios.utilizarTransacao(
      async (tx) => {
        try {
          const usuarios = await repositorioUsuarios.inserirTx(
            tx,
            insertUsuario,
          );
          if (!usuarios[0]) {
            throw new ServerError("Não foi possível criar o usuário.");
          }
          const usuarioId = usuarios[0].id;

          if (permissoes) {
            const valores = permissoes.map((c) => ({
              usuarioId: usuarioId,
              cargo: c,
            }));
            const atualizacoes = await repositorioPermissoes.inserirTx(
              tx,
              ...valores,
            );
            if (atualizacoes <= 0) {
              throw new ServerError(
                "Novo usuário criado, mas não foi possível configurar as permissões.",
              );
            }
          }

          return usuarioId;
        } catch (err) {
          tx.rollback();
          throw err;
        }
      },
    );

    res.send(usuarioId);
  } catch (err) {
    next(err);
  }
}

const AdmAlteracaoSenhaZ = z4.strictObject({
  senha: SenhaZ,
});

// TODO: Verificar necessidade de invalidar sessões
async function substituirSenha(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const parsedBody = AdmAlteracaoSenhaZ.parse(req.body);
    const usuarioId = params.id;

    const registro = await repositorioUsuarios.selecionarPorId(usuarioId);
    if (registro) {
      // Realizar hash da nova senha
      const hashedPassword = await hashSenha(parsedBody.senha);
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
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

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
      res.json({
        id: registro.id,
        nome: registro.nome,
        login: registro.login,
        descricao: registro.descricao,
        habilitado: registro.habilitado,
        modoEscuro: registro.modoEscuro,
        foto: registro.foto as string,
      });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

async function excluirUsuarioId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioUsuarios.selecionarPorId(id);
    if (registro) {
      const atualizacoes = await repositorioUsuarios.excluirPorId(id);
      if (atualizacoes > 0) {
        res.sendStatus(200);
      } else {
        throw new ServerError("Não foi possível excluir a categoria.");
      }
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

// TODO: Handle password change
async function patchUsuario(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedBody = UpdateUsuarioDtoZ.parse(req.body);
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;

    const registro = await repositorioUsuarios.selecionarPorId(id);
    if (registro) {
      const updateFields = {
        nome: parsedBody.nome,
        login: parsedBody.login,
        descricao: parsedBody.descricao,
        habilitado: parsedBody.habilitado,
        modoEscuro: parsedBody.modoEscuro,
        foto: parsedBody.foto,
      } as UpdateUsuarioSchema;

      if (parsedBody.senha) {
        updateFields.hashedPassword = await hashSenha(parsedBody.senha);
      }
      await repositorioUsuarios.atualizarPorId(id, updateFields);
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

const apiV1AdminUsuariosRouter = Router();

apiV1AdminUsuariosRouter
  .get("/", getUsuarios)
  .post("/", mdwRequerBody, criarUsuario)
  .patch("/:id", mdwRequerBody, patchUsuario)
  .post("/alterar-senha/:id", mdwRequerBody, substituirSenha)
  .get("/:id", getUsuarioId)
  .delete("/:id", excluirUsuarioId);

export default apiV1AdminUsuariosRouter;
