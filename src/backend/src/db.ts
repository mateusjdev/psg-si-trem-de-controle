import { DrizzleQueryError, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { Permissoes } from "./db/enums/permissoes";
import { tabelaCategorias } from "./db/schema/categorias";
import { tabelaConfiguracoes } from "./db/schema/configuracoes";
import { tabelaLotes } from "./db/schema/lotes";
import { tabelaPermissoes } from "./db/schema/permissoes";
import { tabelaProdutos } from "./db/schema/produtos";
import { tabelaSessoes } from "./db/schema/sessoes";
import { tabelaTransacoes } from "./db/schema/transacoes";
import { tabelaUnidadesMedida } from "./db/schema/unidadesMedida";
import { tabelaUsuarios } from "./db/schema/usuarios";
import { LogLevel, error, json, notice, warning } from "./logging";
import repositorioBase from "./repository/repositorioBase";
import repositorioPermissoes from "./repository/repositorioPermissoes";
import repositorioUsuarios from "./repository/repositorioUsuarios";
import { hashSenha } from "./system/auth";

const DB_FILE_NAME = process.env.DB_FILE_NAME || "file:database.db";
const bancoDados = drizzle(DB_FILE_NAME);

// TODO: Verificar se a base de dados se encontra no último schema
export async function verificarBancoDados(): Promise<boolean> {
  warning("Verificando conexão a base de dados...", { label: "db" });
  try {
    const tables = [
      tabelaCategorias,
      tabelaConfiguracoes,
      tabelaLotes,
      tabelaPermissoes,
      tabelaProdutos,
      tabelaSessoes,
      tabelaTransacoes,
      tabelaUnidadesMedida,
      tabelaUsuarios,
    ];
    for (let i = 0; i < tables.length; i++) {
      await bancoDados
        .select({
          value: sql`1`,
        })
        .from(tables[i]!)
        .execute();
    }
    notice("Conexão a base de dados OK.", { label: "db" });
  } catch (err) {
    if (err instanceof DrizzleQueryError && err.cause instanceof Error) {
      error(err.cause?.message, { label: "db" });
      error(
        '* Verificar se a base de dados foi inicializada corretamente: "bun run db:push"',
        { label: "db" },
      );
      return false;
    } else {
      throw err;
    }
  }
  return true;
}

// Verifica se há usuários cadastrados no sistema, se não houver, inicializa um administrador
// TODO: Inicializar apenas 1 vez, armazenar informação em configurações.
export async function inicializarAdministrador(): Promise<void> {
  const count = await repositorioUsuarios.contar();
  if (count === 0) {
    warning(
      "Nenhum usuário foi encontrado. Criando usuário administrador e desenvolvedor.",
    );

    // TODO: Gerar senha aleatoria
    const adminLogin = "Administrador";
    const adminSenha = "Admin123-";
    const devLogin = "Desenvolvedor";
    const devSenha = "Devel321-";

    await repositorioBase.utilizarTransacao(async (tx) => {
      try {
        const reg1 = await repositorioUsuarios.inserir({
          nome: adminLogin,
          login: adminLogin,
          hashedPassword: await hashSenha(adminSenha),
          descricao: adminLogin,
          habilitado: true,
        });
        if (!reg1[0]) {
          throw new Error("Não foi possível criar usuário administrador.");
        }
        await repositorioPermissoes.inserir({
          usuarioId: reg1[0].id,
          cargo: Permissoes.Administrador,
        });

        const reg2 = await repositorioUsuarios.inserir({
          nome: devLogin,
          login: devLogin,
          hashedPassword: await hashSenha(devSenha),
          descricao: devLogin,
          habilitado: true,
        });
        if (!reg2[0]) {
          throw new Error("Não foi possível criar usuário desenvolvedor.");
        }
        await repositorioPermissoes.inserir({
          usuarioId: reg2[0].id,
          cargo: Permissoes.Desenvolvedor,
        });
      } catch (err) {
        tx.rollback();
        throw err;
      }
    });

    warning("Credênciais de primeira entrada:");
    json({ login: adminLogin, senha: adminSenha }, LogLevel.Warning);
    json({ login: devLogin, senha: devSenha }, LogLevel.Warning);
  }
}

export default bancoDados;
