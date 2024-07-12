//Desde index.js arrancamos el backend

import appBack from './src/apps/appBack.js'
import {connectDB} from './src/db.js'

connectDB()
appBack.listen(8080)
console.log('En ejecución en el puerto', 8080)


