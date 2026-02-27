import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { MotivoAlerta } from "../../db/enums/motivoAlerta";
import type { ExtendedRequest } from "../../middlewares";
import repositorioAlertas, {
  type RepoConsultaParamsAlerta,
} from "../../repository/repositorioAlertas";
import repositorioLotes from "../../repository/repositorioLotes";
import repositorioProdutos from "../../repository/repositorioProdutos";
import { ParamsIdSchemaZ } from "./objects";

// Tempo padrão: 24 horas (em milisegundos)
const HORAS_24 = 24 * 60 * 60 * 1000;
// const MES_1 = 30 * 24 * 60 * 60 * 1000;

export type GetAlertasDto = {
  id: string;
  produtoId: string;
  loteId: string | null;
  motivo: MotivoAlerta;
  mutadoAte: string | null;
};

export type SetAlertasDto = {
  produtoId: string;
  loteId?: string | null;
  motivo: MotivoAlerta;
};

export const ParamsConsultaAlertasZ = z4.strictObject({
  pagina: z4.coerce.number().int().gt(0).optional(),
  paginaTamanho: z4.coerce.number().int().gt(0).optional(),
  comMotivo: z4.enum(MotivoAlerta).optional(),
});

export type ParamsConsultaAlertas = z4.infer<typeof ParamsConsultaAlertasZ>;

export type GetConsultaAlertasDto = GetAlertasDto & {
  _produto: { nome: string; codigo: string } | null;
  _lote: { codigo: string } | null;
};

async function getAlertas(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (Object.keys(req.query).length === 0) {
      const registros = await repositorioAlertas.selecionarTodos();
      const alertas = registros.map((registro) => ({
        id: registro.id,
        loteId: registro.loteId,
        produtoId: registro.produtoId,
        motivo: registro.motivo,
        mutadoAte: registro.mutadoAte ? registro.mutadoAte.toISOString() : null,
      }));

      res.json(alertas);
    } else {
      const parsedQueryParams = ParamsConsultaAlertasZ.parse(req.query);
      const opts = parsedQueryParams;

      const filters = {
        comMotivo: opts?.comMotivo,
      } as RepoConsultaParamsAlerta;
      const consulta = await repositorioAlertas.selecionarConsulta(filters);
      const alertas = consulta.map((registro) => ({
        id: registro.id,
        produtoId: registro.produtoId,
        loteId: registro.loteId,
        motivo: registro.motivo,
        mutadoAte: registro.mutadoAte?.toISOString() || null,
        _produto: registro._produto
          ? {
              nome: registro._produto.nome,
              codigo: registro._produto.codigo,
            }
          : null,
        _lote: registro._lote
          ? {
              codigo: registro._lote.codigo,
            }
          : null,
      }));

      res.json(alertas);
    }
  } catch (err) {
    next(err);
  }
}

async function getQuantidadeAlertasAtivos(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const quantidade = await repositorioAlertas.contarNaoMutados();
    res.json({
      quantidade,
    });
  } catch (err) {
    next(err);
  }
}

// Tempo padrão: 24 horas
async function patchSilenciarAlerta(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioAlertas.selecionarPorId(id);
    if (registro) {
      const mutarAte = new Date(new Date().getTime() + HORAS_24);
      await repositorioAlertas.atualizarPorId(id, {
        mutadoAte: mutarAte,
      });
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

// TODO: Chamado periodicamente na inicialização do programa
async function postVerificar(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const registrosQuant =
      await repositorioProdutos.selecionarQuantidadesAlertas();

    const validadeAte = new Date(new Date().getTime() + HORAS_24);
    const registrosVal =
      await repositorioLotes.selecionarValidadeAlertas(validadeAte);

    const registros: SetAlertasDto[] = [];
    registrosQuant.forEach((registro) => {
      if (
        registro.quantidadeMaxima !== null &&
        registro.quantidade >= registro.quantidadeMaxima
      ) {
        registros.push({
          produtoId: registro.id,
          motivo: MotivoAlerta.QuantidadeMaxima,
        });
      } else if (
        registro.quantidadeMinima !== null &&
        registro.quantidade <= registro.quantidadeMinima
      ) {
        registros.push({
          produtoId: registro.id,
          motivo: MotivoAlerta.QuantidadeMinima,
        });
      } else {
        throw new Error("Erro ao verificar alertas.");
      }
    });

    await repositorioAlertas.excluirTodos();
    registrosVal.forEach((registro) =>
      registros.push({
        loteId: registro.id,
        produtoId: registro.produtoId,
        motivo: MotivoAlerta.Validade,
      }),
    );
    const registrosIds = await repositorioAlertas.inserir(...registros);
    const consulta = registrosIds.map((registro) => registro.id);

    res.json(consulta);
  } catch (err) {
    next(err);
  }
}

const apiV1AlertasRouter = Router();

apiV1AlertasRouter
  .get("/", getAlertas)
  .get("/quantidade-nao-mutado", getQuantidadeAlertasAtivos)
  .patch("/silenciar/:id", patchSilenciarAlerta)
  .post("/verificar", postVerificar);

export default apiV1AlertasRouter;
