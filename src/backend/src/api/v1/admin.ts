import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import repositorioSessoes from "../../repository/repositorioSessoes";
import apiV1AdminUsuarios from "./admin/usuarios";

const apiV1AdminRouter = Router();

// {host}/api/v1/admin/usuarios
apiV1AdminRouter.use("/usuarios", apiV1AdminUsuarios);

// {host}/api/v1/admin/limpar-sessoes
apiV1AdminRouter.post(
  "/invalidar-sessoes",
  async (_: Request, res: Response, next: NextFunction) => {
    try {
      await repositorioSessoes.excluirTodos();
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  },
);

export default apiV1AdminRouter;
