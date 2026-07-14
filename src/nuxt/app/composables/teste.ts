export const useTest = createUseFetch({
  async onResponseError({ response }) {
    if (response.status === 401) {
      await navigateTo("/login");
    }
  },
});

$fetch.create();
