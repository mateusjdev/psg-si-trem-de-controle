import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { ServerError } from "../../error";
import type { ExtendedRequest } from "../../middlewares";
import { mdwRequerBody } from "../../middlewares";
import repositorioLotes, {
  type RepoConsultaParamsLote,
} from "../../repository/repositorioLotes";
import { ParamsIdSchemaZ } from "./objects";

export const LoteConsultaSchema = z4.object({
  id: z4.uuid().optional(),
  produtoId: z4.uuid().optional(),
  pagina: z4.coerce.number().int().gt(0).optional(),
  paginaTamanho: z4.coerce.number().int().gt(0).optional(),
  quantidadeMin: z4.coerce.number().optional(),
  quantidadeMax: z4.coerce.number().optional(),
  validadeAte: z4.iso.datetime().optional(),
  validadeApos: z4.iso.datetime().optional(),
  codigo: z4.string().min(1).optional(),
});

export type ConsultaLoteParams = z4.infer<typeof LoteConsultaSchema>;

export const SetLoteDtoZ = z4.object({
  produtoId: z4.uuid(),
  codigo: z4.string(),
  quantidade: z4.number(),
  validade: z4.string().nullable(),
});

export type SetLoteDTO = z4.infer<typeof SetLoteDtoZ>;

export type GetLoteDTO = {
  id: string;
  produtoId: string;
  codigo: string;
  quantidade: number;
  validade: string | null;
};

export const UpdateLoteDtoZ = z4.strictObject({
  codigo: z4.string().min(1).optional(),
  quantidade: z4.number().optional(),
  validade: z4.iso.datetime().optional().nullable(),
});

export type UpdateLoteDTO = z4.infer<typeof UpdateLoteDtoZ>;

async function getLotes(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (Object.keys(req.query).length === 0) {
      const registros = await repositorioLotes.selecionarTodos();
      const consulta = registros.map((registro) => ({
        id: registro.id,
        produtoId: registro.produtoId,
        codigo: registro.codigo,
        quantidade: registro.quantidade,
        validade: registro.validade ? registro.validade.toISOString() : null,
      }));

      res.json(consulta);
    } else {
      const parsedQueryParams = LoteConsultaSchema.parse(req.query);

      const filters = {
        comId: parsedQueryParams?.id,
        comProdutoId: parsedQueryParams?.produtoId,
        comCodigo: parsedQueryParams?.codigo,
        comQuantidadeMaiorIgualQue: parsedQueryParams?.quantidadeMin,
        comQuantidadeMenorIgualQue: parsedQueryParams?.quantidadeMax,
      } as RepoConsultaParamsLote;

      if (parsedQueryParams?.validadeApos) {
        const validadeApos = new Date(parsedQueryParams.validadeApos);
        filters.comValidadeMaiorIgualQue = validadeApos;
      }
      if (parsedQueryParams?.validadeAte) {
        const validadeAte = new Date(parsedQueryParams.validadeAte);
        filters.comValidadeMenorIgualQue = validadeAte;
      }
      if (parsedQueryParams?.pagina && parsedQueryParams?.paginaTamanho) {
        filters.pagina = parsedQueryParams?.pagina;
        filters.paginaTamanho = parsedQueryParams?.paginaTamanho;
      }
      const consulta = await repositorioLotes.selecionarConsulta(filters);
      const cons = consulta.map((registro) => ({
        id: registro.id,
        produtoId: registro.produtoId,
        codigo: registro.codigo,
        quantidade: registro.quantidade,
        validade: registro.validade ? registro.validade.toISOString() : null,
      }));

      res.json(cons);
    }
  } catch (err) {
    next(err);
  }
}

async function postLote(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedBody = SetLoteDtoZ.parse(req.body);

    // TODO: Verificar se Id do produto existe ou deixar dar erro na base de dados?
    const consulta = await repositorioLotes.inserir({
      produtoId: parsedBody.produtoId,
      codigo: parsedBody.codigo,
      quantidade: parsedBody.quantidade | 0,
      validade: parsedBody.validade ? new Date(parsedBody.validade) : null,
    });
    if (!consulta[0]) {
      throw new ServerError("Não foi possível criar categoria.");
    } else {
      res.status(201).json({ id: consulta[0].id });
    }
  } catch (err) {
    next(err);
  }
}

async function getLoteId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioLotes.selecionarPorId(id);
    if (registro) {
      res.json({
        id: registro.id,
        produtoId: registro.produtoId,
        codigo: registro.codigo,
        quantidade: registro.quantidade,
        validade: registro.validade ? registro.validade.toISOString() : null,
      });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

async function excluirLoteId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioLotes.selecionarPorId(id);
    if (registro) {
      const atualizacoes = await repositorioLotes.excluirPorId(id);
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

function notImplemented(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    throw new Error("Not implemented");
    // TEST: As atualizações substituem todos os campos ou so alguns?
    // (e se utilizar undefined?)
    /*
    const registro = await repositorioLotes.selecionarPorId(id);
    if (registro) {
      const atualizacoes = await repositorioLotes.atualizarPorId(id, {
        codigo: lote.codigo,
        quantidade: lote.quantidade,
        validade: lote.validade ? new Date(lote.validade) : null,
      });
      if (atualizacoes > 0) {
        return true;
      } else {
        throw new ServerError("Erro ao atualizar lote.");
      }
    } else {
      return false;
    }
      */
  } catch (err) {
    next(err);
  }
}

const apiV1LotesRouter = Router();

apiV1LotesRouter
  .get("/", getLotes)
  .post("/", mdwRequerBody, postLote)
  .get("/:id", getLoteId)
  // TODO: Implementar PUT e PATCH para o endpoint de lotes.
  .put("/:id", notImplemented)
  .patch("/:id", notImplemented)
  .delete("/:id", excluirLoteId);

export default apiV1LotesRouter;
