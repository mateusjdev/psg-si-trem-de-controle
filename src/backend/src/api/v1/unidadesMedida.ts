import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { InsertUnidadesMedidasSchemaZ } from "../../db/schema/unidadesMedida";
import { ClientError, ServerError } from "../../error";
import type { ExtendedRequest } from "../../middlewares";
import { mdwRequerBody } from "../../middlewares";
import repositorioProdutos from "../../repository/repositorioProdutos";
import repositorioUnidadesMedida from "../../repository/repositorioUnidadesMedida";
import { ParamsIdSchemaZ } from "./objects";

export const SetUnidadeDtoZ = z4.object({
  nome: z4.string().min(1).max(128),
  abreviacao: z4.string().min(1).max(8),
});

export type SetUnidadeDTO = z4.infer<typeof SetUnidadeDtoZ>;

export type GetUnidadeDto = {
  id: string;
  nome: string;
  abreviacao: string;
};

async function getUnidadesMedida(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const registros = await repositorioUnidadesMedida.selecionarTodos();
    const unidadesMedida = registros.map((r) => ({
      id: r.id,
      nome: r.nome,
      abreviacao: r.abreviacao,
    }));

    res.json(unidadesMedida);
  } catch (err) {
    next(err);
  }
}

async function postUnidadeMedida(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const unidadeMedida = InsertUnidadesMedidasSchemaZ.parse(req.body);
    // TODO: Verificar se entidade já existe
    const resultado = await repositorioUnidadesMedida.inserir({
      nome: unidadeMedida.nome,
      abreviacao: unidadeMedida.abreviacao,
    });

    if (resultado[0]) {
      res.send(resultado[0].id);
    } else {
      // throw new ServerError("Não foi possível criar categoria.");
      res.sendStatus(500);
    }
  } catch (err) {
    next(err);
  }
}

async function getUnidadeMedida(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const unidadeMedida = await repositorioUnidadesMedida.selecionarPorId(id);
    if (unidadeMedida) {
      res.json({
        id: unidadeMedida.id,
        nome: unidadeMedida.nome,
        abreviacao: unidadeMedida.abreviacao,
      });
    } else {
      res.sendStatus(500);
    }
  } catch (err) {
    next(err);
  }
}

async function deleteUnidadeMedida(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioUnidadesMedida.selecionarPorId(id);
    if (registro) {
      const usos = await repositorioProdutos.selecionarPorUnidadeMedida(id);
      if (usos!.count > 0) {
        throw new ClientError("Há produtos cadastrados com essa unidade!", 409);
      }
      const atualizacoes = await repositorioUnidadesMedida.excluirPorId(id);
      if (atualizacoes > 0) {
        res.sendStatus(200);
      } else {
        throw new ServerError("Não foi possível excluir a unidade.");
      }
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

const apiV1UnidadesMedida = Router();

apiV1UnidadesMedida
  .get("/", getUnidadesMedida)
  .post("/", mdwRequerBody, postUnidadeMedida)
  .get("/:id", getUnidadeMedida)
  .delete("/:id", deleteUnidadeMedida);

export default apiV1UnidadesMedida;
