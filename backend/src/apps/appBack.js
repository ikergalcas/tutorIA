//Para poner en marcha el backend ejecuto el comando npm run dev. Puedo cambiar el comando dev por otro
//desde package.json en la parte de scripts
import express from 'express'
import morgan from 'morgan'     //Morgan nos permite ver en el terminal las peticiones hechas al backend 
import routerBack from '../routes/routerBack.js'
import cors from 'cors'
import fileUpload from "express-fileupload"

const app = express()

app.use(cors());
app.use(fileUpload()); //Revisar utilidad
app.use(express.json()) //Esto es para convertir los req.body en formato json
app.use('/', routerBack)

export default app;