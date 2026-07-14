// TODO(regresion): Handle nextPage= or callbackUrl=
export default defineNuxtRouteMiddleware((to, from) => {
  // TODO: sessao.isLoggedIn
  const isLoggedIn = true;
  if (isLoggedIn) {
    return navigateTo(to);
  }
  return navigateTo(`/login`, {
    replace: true,
    external: false,
    redirectCode: 302,
  });
});
