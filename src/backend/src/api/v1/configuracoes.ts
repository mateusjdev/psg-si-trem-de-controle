import { type NextFunction, type Response, Router } from "express";
import z4 from "zod/v4";
import { Identificador } from "../../db/enums/identificador";
import { error } from "../../logging";
import type { ExtendedRequest } from "../../middlewares";
import { mdwRequerBody } from "../../middlewares";
import repositorioConfiguracoes from "../../repository/repositorioConfiguracoes";
import servicoProdutos from "../../services/servicoProdutos";

// Por enquanto haverá apenas 1 configuração padrão
const defaultUuid = "00000000-0000-0000-0000-000000000000";

export type GetConfiguracaoDto = {
  // id: string;
  nomeCliente: string | null;
  cpfCnpj: string | null;
  endereco: string | null;
  identificador: Identificador;
};

export const UpdateConfiguracaoDtoZ = z4.strictObject({
  nomeCliente: z4.string().nullable().optional(),
  cpfCnpj: z4.string().nullable().optional(),
  endereco: z4.string().nullable().optional(),
  identificador: z4.enum(Identificador).optional(),
});

export type UpdateConfiguracaoDto = z4.infer<typeof UpdateConfiguracaoDtoZ>;

/**
 * Essa função garante que o único registro de configurações na base de dados existe
 */
async function inicializar(): Promise<void> {
  const resSel1 = await repositorioConfiguracoes.selecionarPorId(defaultUuid);
  if (resSel1) {
    return;
  }
  await repositorioConfiguracoes.inserir({ id: defaultUuid });
  const resSel2 = await repositorioConfiguracoes.selecionarPorId(defaultUuid);
  if (!resSel2) {
    throw new Error(
      "Não foi possível inicializar os valores de configurações.",
    );
  }
}

async function getConfiguracoes(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await inicializar();
    const registro =
      await repositorioConfiguracoes.selecionarPorId(defaultUuid);
    if (registro) {
      res.json({
        nomeCliente: registro.nomeCliente,
        cpfCnpj: registro.cpfCnpj,
        endereco: registro.endereco,
        identificador: registro.identificador,
      });
    } else {
      error("Nenhum valor encontrado.", { label: "endConfig" });
      res.sendStatus(500);
    }
  } catch (err) {
    next(err);
  }
}

async function patchConfiguracoes(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedBody = UpdateConfiguracaoDtoZ.parse(req.body);
    await inicializar();
    const _configuracoes = UpdateConfiguracaoDtoZ.parse(parsedBody);
    const atualizacoes = await repositorioConfiguracoes.atualizarPorId(
      defaultUuid,
      {
        nomeCliente: _configuracoes.nomeCliente,
        cpfCnpj: _configuracoes.cpfCnpj,
        endereco: _configuracoes.endereco,
        identificador: _configuracoes.identificador,
      },
    );
    if (atualizacoes > 0) {
      res.sendStatus(200);
    } else {
      // throw new ServerError("Não foi possível atualizar as configurações.");
      error("Atualização não realizada.", { label: "endConfig" });
      res.sendStatus(500);
    }
  } catch (err) {
    next(err);
  }
}

async function alterarIdentificador(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsedBody = z4
      .object({
        identificador: z4.enum(Identificador),
      })
      .parse(req.body);
    // TODO: Retornar alguma coisa indicando erro/sucesso
    await servicoProdutos.alterarFormatoCodigo(parsedBody.identificador);
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

const apiV1ConfiguracoesRouter = Router();

apiV1ConfiguracoesRouter
  .get("/", getConfiguracoes)
  .patch("/codigo", mdwRequerBody, alterarIdentificador)
  .patch("/", mdwRequerBody, patchConfiguracoes);

export default apiV1ConfiguracoesRouter;
