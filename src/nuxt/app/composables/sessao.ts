export const useSessao = () => {
  function verificarLogin(): Promise<boolean> {}
  function logout(): Promise<void> {
    return;
  }
  function verificarLogin(): Promise<boolean> {
    useFetch();
  }

  return {
    verificarLogin,
  };
};
