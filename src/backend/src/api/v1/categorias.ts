import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { InsertCategoriaSchemaZ } from "../../db/schema/categorias";
import { ClientError, ServerError } from "../../error";
import type { ExtendedRequest } from "../../middlewares";
import { mdwRequerBody } from "../../middlewares";
import repositorioCategorias from "../../repository/repositorioCategorias";
import repositorioProdutos from "../../repository/repositorioProdutos";
import { ParamsIdSchemaZ } from "./objects";

export const SetCategoriaDtoZ = z4.strictObject({
  nome: z4.string().min(1).max(128),
});

export type SetCategoriaDTO = z4.infer<typeof SetCategoriaDtoZ>;

export const GetCategoriaDtoZ = z4.strictObject({
  id: z4.uuid(),
  nome: z4.string().min(1).max(128),
});

export type GetCategoriaDTO = z4.infer<typeof GetCategoriaDtoZ>;

async function getCategorias(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const registros = await repositorioCategorias.selecionarTodos();
    const categorias = registros.map((registro) => ({
      id: registro.id,
      nome: registro.nome,
    }));
    res.json(categorias);
  } catch (err) {
    next(err);
  }
}

async function postCategoria(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // TODO: Verificar se nome já existe (Testar Upper/Lowercase)
    const categoria = InsertCategoriaSchemaZ.parse(req.body);
    const reg = await repositorioCategorias.inserir({
      nome: categoria.nome,
    });
    if (!reg[0]) {
      throw new ServerError("Não foi possível criar categoria.");
    } else {
      res.send(reg[0].id);
    }
  } catch (err) {
    next(err);
  }
}

async function getCategoria(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const categoria = await repositorioCategorias.selecionarPorId(id);
    if (categoria) {
      res.json({
        id: categoria.id,
        nome: categoria.nome,
      });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

async function deleteCategorias(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // TODO: validar UUID
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioCategorias.selecionarPorId(id);
    if (registro) {
      const usos = await repositorioProdutos.contarPorCategoriaId(id);
      if (usos > 0) {
        throw new ClientError(
          "Há produtos cadastrados com essa categoria!",
          409,
        );
      }
      const atualizacoes = await repositorioCategorias.excluirPorId(id);
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

const apiV1CategoriasRouter = Router();

apiV1CategoriasRouter
  .get("/", getCategorias)
  .post("/", mdwRequerBody, postCategoria)
  .get("/:id", getCategoria)
  .delete("/:id", deleteCategorias);

export default apiV1CategoriasRouter;
