import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { StatusProduto } from "../../db/enums/statusProduto";
import { geradorCodigo } from "../../db/geradorCodigos";
import { HttpError } from "../../error";
import { z4Base64File } from "../../helpers";
import { debug } from "../../logging";
import type { ExtendedRequest } from "../../middlewares";
import repositorioProdutos, {
  type RepoConsultaParamsProdutoQuantidade,
} from "../../repository/repositorioProdutos";
import { ParamsIdSchemaZ } from "./objects";

export const SetProdutoDtoZ = z4.object({
  nome: z4.string(),
  codigo: z4.string().optional(),
  sku: z4.string().nullish(),
  codigoBarra: z4.string().nullish(),
  descricao: z4.string().nullish(),
  categoriaId: z4.uuid().nullish(),
  marca: z4.string().nullish(),
  fornecedor: z4.string().nullish(),
  dimensoes: z4.string().nullish(),
  peso: z4.number().nullish(),
  precoCusto: z4.number().nullish(),
  precoVenda: z4.number().nullish(),
  precoPromocao: z4.number().nullish(),
  unidadeMedidaId: z4.uuid().nullish(),
  quantidadeMinima: z4.number().nullish(),
  quantidadeMaxima: z4.number().nullish(),
  localizacao: z4.string().nullish(),
  imagem: z4Base64File.optional(),
  status: z4.enum(StatusProduto),
});

export type SetProdutoDto = z4.infer<typeof SetProdutoDtoZ>;

export const GetProdutoDtoZ = z4.object({
  id: z4.uuid(),
  nome: z4.string(),
  codigo: z4.string(),
  sku: z4.string().nullable(),
  codigoBarra: z4.string().nullable(),
  descricao: z4.string().nullable(),
  categoriaId: z4.uuid().nullable(),
  marca: z4.string().nullable(),
  fornecedor: z4.string().nullable(),
  dimensoes: z4.string().nullable(),
  peso: z4.number().nullable(),
  precoCusto: z4.number().nullable(),
  precoVenda: z4.number().nullable(),
  precoPromocao: z4.number().nullable(),
  unidadeMedidaId: z4.uuid().nullable(),
  quantidadeMinima: z4.number().nullable(),
  quantidadeMaxima: z4.number().nullable(),
  localizacao: z4.string().nullable(),
  imagem: z4Base64File.optional(),
  status: z4.enum(StatusProduto),
});

export type GetProdutoDto = z4.infer<typeof GetProdutoDtoZ>;

export const GetConsultaProdutoDtoZ = GetProdutoDtoZ.extend({
  categoria: z4.string().nullable().optional(),
  quantidade: z4.number().nullable().optional(),
});

export type GetConsultaProdutoDto = z4.infer<typeof GetConsultaProdutoDtoZ>;

export const ParamsConsultaProdutosZ = z4.strictObject({
  id: z4.uuid().optional(),
  pagina: z4.coerce.number().int().gt(0).optional(),
  paginaTamanho: z4.coerce.number().int().gt(0).optional(),
  precoCustoMin: z4.coerce.number().int().gt(0).optional(),
  precoCustoMax: z4.coerce.number().int().gt(0).optional(),
  precoVendaMin: z4.coerce.number().int().gt(0).optional(),
  precoVendaMax: z4.coerce.number().int().gt(0).optional(),
  precoPromocaoMin: z4.coerce.number().int().gt(0).optional(),
  precoPromocaoMax: z4.coerce.number().int().gt(0).optional(),
  pesoMin: z4.coerce.number().int().gt(0).optional(),
  pesoMax: z4.coerce.number().int().gt(0).optional(),
  texto: z4.string().min(1).optional(),
  categoriaId: z4.uuid().optional(),
});

export type ParamsConsultaProdutos = z4.infer<typeof ParamsConsultaProdutosZ>;

async function postProdutos(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedBody = SetProdutoDtoZ.parse(req.body);
    const codigo = geradorCodigo();
    const resultado = await repositorioProdutos.inserir({
      ...parsedBody,
      codigo: codigo,
    });
    if (resultado.length !== 1 || !resultado[0]) {
      throw new HttpError("", 500);
    }
    debug(`Novo produto criada!`, { label: "ServProdutos" });
    const idRegistro = resultado[0].id;

    res.status(201).json({ id: idRegistro });
  } catch (err) {
    next(err);
  }
}
async function getProdutos(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (Object.keys(req.query).length === 0) {
      const registros = await repositorioProdutos.selecionarTodos();
      const consulta = registros.map((registro) => ({
        id: registro.id,
        nome: registro.nome,
        codigo: registro.codigo,
        sku: registro.sku,
        codigoBarra: registro.codigoBarra,
        descricao: registro.descricao,
        // TODO: map() categoriaId -> Nome Categoria
        categoriaId: registro.categoriaId,
        marca: registro.marca,
        fornecedor: registro.fornecedor,
        dimensoes: registro.dimensoes,
        peso: registro.peso,
        precoCusto: registro.precoCusto,
        precoVenda: registro.precoVenda,
        precoPromocao: registro.precoPromocao,
        quantidadeMinima: registro.quantidadeMinima,
        quantidadeMaxima: registro.quantidadeMaxima,
        localizacao: registro.localizacao,
        imagem: registro.imagem as string,
        status: registro.status,
        unidadeMedidaId: registro.unidadeMedidaId,
      }));
      res.json(consulta);
    } else {
      const parsedBody = ParamsConsultaProdutosZ.parse(req.query);

      const filtros = {
        comId: parsedBody?.id,
        comCategoriaId: parsedBody?.categoriaId,
        comTexto: parsedBody?.texto,
        comPrecoCustoMaiorIgualQue: parsedBody?.precoCustoMin,
        comPrecoCustoMenorIgualQue: parsedBody?.precoCustoMax,
        comPrecoVendaMaiorIgualQue: parsedBody?.precoVendaMin,
        comPrecoVendaMenorIgualQue: parsedBody?.precoVendaMax,
        comPrecoPromocaoMaiorIgualQue: parsedBody?.precoPromocaoMin,
        comPrecoPromocaoMenorIgualQue: parsedBody?.precoPromocaoMax,
        comPesoMaiorIgualQue: parsedBody?.pesoMin,
        comPesoMenorIgualQue: parsedBody?.pesoMax,
      } as RepoConsultaParamsProdutoQuantidade;

      if (parsedBody?.pagina && parsedBody?.paginaTamanho) {
        filtros.pagina = parsedBody?.pagina;
        filtros.paginaTamanho = parsedBody?.paginaTamanho;
      }

      const registros =
        await repositorioProdutos.selecionarConsultaCompleta(filtros);
      const consulta = registros.map((registro) => ({
        id: registro.id,
        nome: registro.nome,
        codigo: registro.codigo,
        sku: registro.sku,
        codigoBarra: registro.codigoBarra,
        descricao: registro.descricao,
        // TODO: map() categoriaId -> Nome Categoria
        categoriaId: registro.categoriaId,
        marca: registro.marca,
        fornecedor: registro.fornecedor,
        dimensoes: registro.dimensoes,
        peso: registro.peso,
        precoCusto: registro.precoCusto,
        precoVenda: registro.precoVenda,
        precoPromocao: registro.precoPromocao,
        quantidadeMinima: registro.quantidadeMinima,
        quantidadeMaxima: registro.quantidadeMaxima,
        localizacao: registro.localizacao,
        imagem: registro.imagem as string,
        status: registro.status,
        unidadeMedidaId: registro.unidadeMedidaId,
        quantidade: registro.quantidade,
        categoria: registro.categoria,
      }));

      res.json(consulta);
    }
  } catch (err) {
    next(err);
  }
}

async function getProdutoId(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = ParamsIdSchemaZ.parse(req.params);
    const { id } = params;
    const registro = await repositorioProdutos.selecionarPorId(id);
    if (registro) {
      res.json({
        id: registro.id,
        nome: registro.nome,
        codigo: registro.codigo,
        sku: registro.sku,
        codigoBarra: registro.codigoBarra,
        descricao: registro.descricao,
        // TODO: map() categoriaId -> Nome Categoria
        categoriaId: registro.categoriaId,
        marca: registro.marca,
        fornecedor: registro.fornecedor,
        dimensoes: registro.dimensoes,
        peso: registro.peso,
        precoCusto: registro.precoCusto,
        precoVenda: registro.precoVenda,
        precoPromocao: registro.precoPromocao,
        quantidadeMinima: registro.quantidadeMinima,
        quantidadeMaxima: registro.quantidadeMaxima,
        localizacao: registro.localizacao,
        imagem: registro.imagem as string,
        status: registro.status,
        unidadeMedidaId: registro.unidadeMedidaId,
      });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
}

const apiV1ProdutosRouter = Router();

apiV1ProdutosRouter
  .get("/", getProdutos)
  .get("/:id", getProdutoId)
  .post("/", postProdutos);

export default apiV1ProdutosRouter;
