import auth from "./auth";

type Permissoes = string;
export type GrupoPermissoes = Permissoes[];

function possuiPermissao(
  permNecessarias: GrupoPermissoes,
  permExistentes: GrupoPermissoes,
) {
  return permNecessarias.reduce(
    (rdcAnd, necessaria) => rdcAnd && permExistentes.includes(necessaria),
    true,
  );
}

function permitir(
  permNecessarias: GrupoPermissoes[],
  grupoPermissoes: GrupoPermissoes,
) {
  const permitido = permNecessarias.reduce(
    (rdcOr, permNecessaria) =>
      rdcOr || possuiPermissao(permNecessaria, grupoPermissoes),
    false,
  );
  return permitido;
}

export default defineNuxtRouteMiddleware((to, from) => {
  addRouteMiddleware(auth);
  const permNecessarias = to.meta.requerPermissoes;
  if (permNecessarias == null) {
    return navigateTo(to);
  }
  // Permissoes[][] -> [Or][And]
  if (Array.isArray(permNecessarias) && permNecessarias.length !== 0) {
    if (permitir(permNecessarias, PermissionStatus.permissoes())) {
      return navigateTo(to);
    }
    return navigateTo("/404", {
      replace: true,
      redirectCode: 404,
    });
  }
  return abortNavigation();
});
