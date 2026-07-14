import { sessao } from '@/main'
import MotivoAlertaView from '@/views/AlertasView.vue'
import CadastroUsuariosView from '@/views/CadastroUsuariosView.vue'
import ConfiguracoesView from '@/views/ConfiguracoesView.vue'
import DesenvolvedorView from '@/views/DesenvolvedorView.vue'
import LoadingView from '@/views/LoadingView.vue'
import LoginView from '@/views/LoginView.vue'
import MovimentacoesView from '@/views/MovimentacoesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import OperacoesDiariasView from '@/views/OperacoesDiariasView.vue'
import PesquisaProdutosView from '@/views/PesquisaProdutosView.vue'
import { createRouter, createWebHistory, type NavigationGuardNext } from 'vue-router'
import { Permissoes } from '../../../backend'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      name: 'start',
      path: '/',
      redirect: '/operacoes',
    },
    {
      name: 'loading',
      path: '/loading',
      component: LoadingView,
    },
    {
      name: 'login',
      path: '/login',
      component: LoginView,
    },
    {
      // Página de controle de estoque (registra entradas e saidas).
      name: 'operacoes',
      path: '/operacoes',
      component: OperacoesDiariasView,
      meta: {
        requerAutenticacao: true,
      },
    },
    {
      // Página de visualização de registro (histórico de movimentações).
      name: 'movimentacoes',
      path: '/movimentacoes',
      component: MovimentacoesView,
      meta: {
        requerAutenticacao: true,
      },
    },
    {
      name: 'produtos',
      path: '/produtos',
      component: PesquisaProdutosView,
      meta: {
        requerAutenticacao: true,
      },
    },

    {
      name: 'alertas',
      path: '/alertas',
      component: MotivoAlertaView,
      meta: {
        requerAutenticacao: true,
      },
    },
    {
      name: 'usuarios',
      path: '/usuarios',
      meta: {
        requerAutenticacao: true,
        requerPermissoes: [[Permissoes.Administrador], [Permissoes.Desenvolvedor]],
      },
      component: CadastroUsuariosView,
    },
    {
      name: 'configuracoes',
      path: '/configuracoes',
      component: ConfiguracoesView,
      meta: {
        requerAutenticacao: true,
      },
    },
    {
      name: 'desenvolvedor',
      path: '/desenvolvedor',
      component: DesenvolvedorView,
      meta: {
        requerAutenticacao: true,
        requerPermissoes: [[Permissoes.Desenvolvedor]],
      },
    },
    {
      // Matches any path not previously matched
      path: '/:pathMatch(.*)*',
      name: '404',
      component: NotFoundView,
    },
    {
      name: 'CriarProdutoView',
      path: '/produtos/:id',
      component: () => import('@/views/CriarProdutoView.vue'),
    },
  ],
})

router.beforeEach((to, _from, next: NavigationGuardNext) => {
  // TODO: Realizar autenticação mais elegante
  if (to.matched.some((record) => record.meta.requerPermissoes)) {

  } else {
    next()
  }
})

export default router
