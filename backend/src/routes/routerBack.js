import express from 'express'

import { calcularNota, evaluarLLM, evaluarVectores, generarPreguntas, getPreguntas, marcarPregunta, procesarDocumento, reiniciarPreguntas, siguientePregunta, speechToTextGoogle} from '../controllers/BackController.js'

const routerBack = express.Router()

routerBack.post('/procesarDocumento', procesarDocumento)
routerBack.post('/generarPreguntas', generarPreguntas)
routerBack.get('/getPreguntas/:numBloque', getPreguntas)
routerBack.get('/siguientePregunta', siguientePregunta)
routerBack.post('/evaluar', evaluarVectores)
routerBack.post('/evaluarLLM', evaluarLLM)
routerBack.post('/marcarPregunta', marcarPregunta)
routerBack.get('/reiniciarPreguntas', reiniciarPreguntas)
routerBack.get('/calcularNota', calcularNota)
routerBack.post('/speechToTextGoogle', speechToTextGoogle)

export default routerBack