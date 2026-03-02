import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { MotivoTransacoes } from "../../db/enum/motivoTransacao";
import { ServerError } from "../../error";
import type { ExtendedRequest } from "../../middlewares";
import repositorioMovimentacoes, {
  type RepoConsultaParamsTransacoes,
} from "../../repository/repositorioTransacoes";

export const GetMovimentacaoDtoZ = z4.strictObject({
  id: z4.uuid(),
  produtoId: z4.uuid(),
  usuarioId: z4.uuid(),
  loteId: z4.uuid(),
  motivo: z4.string(),
  quantidade: z4.int(),
  horario: z4.iso.datetime(),
  localOrigem: z4.string().nullable().optional(),
  localDestino: z4.string().nullable().optional(),
  observacao: z4.string().nullable().optional(),
});

export type GetMovimentacaoDto = z4.infer<typeof GetMovimentacaoDtoZ>;

export const SetMovimentacaoDtoZ = z4.strictObject({
  produtoId: z4.uuid(),
  usuarioId: z4.uuid(),
  loteId: z4.uuid(),
  motivo: z4.enum(MotivoTransacoes),
  quantidade: z4.int(),
  horario: z4.iso.datetime(),
  localOrigem: z4.string().optional(),
  localDestino: z4.string().optional(),
  observacao: z4.string().optional(),
});

export type SetMovimentacaoDto = z4.infer<typeof SetMovimentacaoDtoZ>;

export const ConsultaMovimentacoesParamsZ = z4.strictObject({
  id: z4.uuid().optional(),
  produtoId: z4.uuid().optional(),
  usuarioId: z4.uuid().optional(),
  loteId: z4.uuid().optional(),
  // corce: os parametros são recebidos como string
  pagina: z4.coerce.number().int().gt(0).optional(),
  paginaTamanho: z4.coerce.number().int().gt(0).optional(),
  dataApos: z4.iso.datetime().optional(),
  dataAntes: z4.iso.datetime().optional(),
  motivo: z4.enum(MotivoTransacoes).optional(),
});

export type ConsultaMovimentacoesParams = z4.infer<
  typeof ConsultaMovimentacoesParamsZ
>;

export const GetConsultaMovimentacaoDtoZ = GetMovimentacaoDtoZ.extend({
  _usuario: z4.object({ nome: z4.string() }),
  _categoria: z4.object({ nome: z4.string() }).optional(),
  _produto: z4.strictObject({
    nome: z4.string(),
    codigo: z4.string(),
  }),
  _lote: z4.object({ codigo: z4.string() }),
});

export type GetConsultaMovimentacaoDto = z4.infer<
  typeof GetConsultaMovimentacaoDtoZ
>;

async function getTransacoes(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (Object.keys(req.query).length === 0) {
      const registros = await repositorioMovimentacoes.selecionarTodos();
      const consulta = registros.map((registro) => ({
        id: registro.id,
        produtoId: registro.produtoId,
        usuarioId: registro.usuarioId,
        loteId: registro.loteId,
        motivo: registro.motivo,
        quantidade: registro.quantidade,
        horario: new Date(registro.horario).toISOString(),
        localOrigem: registro.localOrigem,
        localDestino: registro.localDestino,
        observacao: registro.observacao,
      }));

      res.json(consulta);
    } else {
      const parsedQueryParams = ConsultaMovimentacoesParamsZ.parse(req.query);

      const filtros = {
        comId: parsedQueryParams?.id,
        comProdutoId: parsedQueryParams?.produtoId,
        comUsuarioId: parsedQueryParams?.usuarioId,
        comLoteId: parsedQueryParams?.loteId,
      } as RepoConsultaParamsTransacoes;

      if (parsedQueryParams?.dataApos) {
        filtros.comDataMaiorQue = new Date(parsedQueryParams.dataApos);
      }
      if (parsedQueryParams?.dataAntes) {
        filtros.comDataMenorQue = new Date(parsedQueryParams.dataAntes);
      }
      if (parsedQueryParams?.pagina && parsedQueryParams?.paginaTamanho) {
        filtros.pagina = parsedQueryParams?.pagina;
        filtros.paginaTamanho = parsedQueryParams?.paginaTamanho;
      }
      if (parsedQueryParams?.motivo) {
        filtros.comMotivo = parsedQueryParams.motivo;
      }

      const registros =
        await repositorioMovimentacoes.selecionarConsulta(filtros);
      const consulta = registros.map((registro) => {
        if (
          registro._usuario === null ||
          // registro._categoria === null ||
          registro._produto === null ||
          registro._lote === null
        ) {
          throw new ServerError("Houve um erro ao verificar os registros.");
        } else {
          return {
            id: registro.id,
            produtoId: registro.produtoId,
            usuarioId: registro.usuarioId,
            loteId: registro.loteId,
            motivo: registro.motivo,
            quantidade: registro.quantidade,
            horario: registro.horario.toISOString(),
            localOrigem: registro.localOrigem,
            localDestino: registro.localDestino,
            observacao: registro.observacao,
            _usuario: { nome: registro._usuario.nome },
            _categoria: registro._categoria
              ? { nome: registro._categoria.nome }
              : undefined,
            _produto: {
              nome: registro._produto.nome,
              codigo: registro._produto.codigo,
            },
            _lote: { codigo: registro._lote.codigo },
          };
        }
      });

      res.json(consulta);
    }
  } catch (err) {
    next(err);
  }
}

async function criarTransacao(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dados = SetMovimentacaoDtoZ.parse(req.body);
    const insercao = await repositorioMovimentacoes.inserir({
      ...dados,
      horario: new Date(dados.horario),
    });

    if (insercao[0]) {
      res.status(201).json({ id: insercao[0].id });
    } else {
      throw new ServerError("Não foi possível registrar a movimentação!");
    }
  } catch (err) {
    next(err);
  }
}

const apiV1TransacoesRouter = Router();

// TODO: verificar permissões
apiV1TransacoesRouter.get("/", getTransacoes);
apiV1TransacoesRouter.post("/", criarTransacao);

export default apiV1TransacoesRouter;
