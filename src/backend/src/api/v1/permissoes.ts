import { type NextFunction, type Response, Router } from "express";
import * as z4 from "zod/v4";
import { Permissoes } from "../../db/enums/permissoes";
import { ServerError } from "../../error";
import { type ExtendedRequest, mdwRequerBody } from "../../middlewares";
import repositorioPermissoes from "../../repository/repositorioPermissoes";
import repositorioUsuarios from "../../repository/repositorioUsuarios";
import { ParamsIdSchemaZ } from "./objects";

const apiV1PermissoesRouter = Router();

async function verPermissoesId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registros = await repositorioPermissoes.selecionarPorIdUsuario(id);
    const permissoes = registros.map((p) => p.cargo);
    res.json(permissoes);
  } catch (err) {
    next(err);
  }
}

const PermsPermissoesArrayZ = z4.array(z4.enum(Permissoes));

async function addPermissoesId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const parsedBody = PermsPermissoesArrayZ.parse(req.body);
    const regUsuario = await repositorioUsuarios.selecionarPorId(id);
    if (!regUsuario) {
      const valores = parsedBody.map((c) => ({
        usuarioId: id,
        cargo: c,
      }));
      const atualizacoes = await repositorioPermissoes.inserir(...valores);
      // TODO: Verificar se não houve atualizados devido ao usuário já possuir as permissões
      if (atualizacoes <= 0) {
        throw new ServerError(
          "Não foi possível alterar as permissões do usuário.",
        );
      }

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}
async function setPermissoesId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const parsedBody = PermsPermissoesArrayZ.parse(req.body);
    const regUsuario = await repositorioUsuarios.selecionarPorId(id);
    if (regUsuario) {
      await repositorioPermissoes.excluirPermissoes(id);
      const valores = parsedBody.map((c) => ({ usuarioId: id, cargo: c }));
      const atualizacoes = await repositorioPermissoes.inserir(...valores);
      if (atualizacoes <= 0) {
        throw new ServerError(
          "Houve um erro ao alterar as permissões do usuário.",
        );
      } else {
        res.sendStatus(200);
      }
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}
async function delPermissoesId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const parsedBody = PermsPermissoesArrayZ.parse(req.body);

    // TODO: Verificar se usuário existe
    // TODO: Evitar transactions
    const regUsuario = await repositorioUsuarios.selecionarPorId(id);
    if (regUsuario) {
      let atualizacoes = 0;
      for (let i = 0; i < parsedBody.length; i++) {
        atualizacoes += await repositorioPermissoes.excluir(id, parsedBody[i]!);
      }
      if (atualizacoes > 0) {
        res.sendStatus(200);
      } else {
        res.sendStatus(500);
      }
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

apiV1PermissoesRouter
  .get("/ver/:id", verPermissoesId)
  .post("/add/:id", mdwRequerBody, addPermissoesId)
  .patch("/set/:id", mdwRequerBody, setPermissoesId)
  .patch("/remove/:id", mdwRequerBody, delPermissoesId);

export default apiV1PermissoesRouter;
