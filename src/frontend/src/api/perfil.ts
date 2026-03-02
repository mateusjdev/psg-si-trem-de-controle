import type { SetPerfilDto } from '../../../backend'
import { UuidParseZ } from './common'
import { HttpMethods, fetchW } from './fetchWrapper'

const endpoint_path = `/api/v1/perfil`

export class ApiPerfil {
  obterPorId(id: string) {
    const _id = UuidParseZ.parse(id)
    return fetchW(`${endpoint_path}/${_id}`)
  }

  atualizarPerfil(opts: SetPerfilDto) {
    return fetchW(`${endpoint_path}`, {
      method: HttpMethods.Patch,
      body: opts,
    })
  }

  alterarSenha(senhaAnterior: string, senhaNova: string) {
    return fetchW(`${endpoint_path}/alterar-senha`, {
      method: HttpMethods.Post,
      body: {
        senhaAnterior,
        senhaNova,
      },
    })
  }
}
