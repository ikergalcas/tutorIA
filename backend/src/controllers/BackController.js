import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import 'dotenv/config'
import Bloques from "../models/BackModel.js";
import { similarity } from "ml-distance";
import { SpeechClient } from "@google-cloud/speech"
// Recibe el documento y lo procesa en bloques de información útil
export const procesarDocumento = async (req, res) => {
    try {
        let relevantBlocks = [];
        
        // Credenciales API DocumentAI
        const projectId = 'tutoria-422617';
        const location = 'eu';
        const processorId = '1b8c20767ea6c9a1';

        // Creación de cliente de servicio para hacer uso de la API
        const client = new DocumentProcessorServiceClient({apiEndpoint: 'eu-documentai.googleapis.com'});
        
        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        //Recibe el contenido el PDF en formato hexadecimal (bytes)
        const imageFile = req.files.myDocument.data 

        // console.log(imageFile)

        // Codifica los bytes en base64
        const encodedImage = Buffer.from(imageFile).toString('base64');

        const request = {
            name,
            rawDocument: {
                content: encodedImage,
                mimeType: 'application/pdf',
            },
        };

        // Recognizes text entities in the PDF document
        const [result] = await client.processDocument(request);

        // Read the text recognition output from the processor
        const {document} = result;
        const {text} = document;

        // Load the relevant blocks from the processor into a variable
        var page_jump_block = '';
        var cnt = 0;
        for (const page of document.pages) {
            for(const block of page.blocks){
                var block_content = getText(block.layout.textAnchor, text)
                if (block_content.length > 200) {
                    var last_char = block_content[block_content.length-2]
                    if (last_char != '.') {
                        page_jump_block = block_content.substring(0,block_content.length-1)
                    } else {
                        if(page_jump_block == ''){
                            relevantBlocks[cnt] = [block_content,""]
                        } else {
                            relevantBlocks[cnt] = [page_jump_block+'\n'+block_content,""]
                            page_jump_block = ''
                        }
                        cnt++;
                    }
                }
            }
        }

        // Busca si hay información de otro documento guardada y la borra (Ahora mismo solo necesitamos de 1 al mismo tiempo)
        await Bloques.findOneAndDelete({id: 1});
        const newBloques = new Bloques();
        newBloques.bloquesRelevantes = relevantBlocks
        await newBloques.save()

        var timestamp = new Date();
        console.log('Procesamiento de documento completado (' + timestamp.toLocaleTimeString() + ")");

        res.json({
            mensaje: 'Documento procesado correctamente',
            bloques: relevantBlocks
        })
    } catch (error) {
        console.log('Error al procesar el documento:', error);
        res.status(500).json({ mensaje: 'Error al procesar el documento:' });
    }
};

// Función auxiliar para procesar documento
const getText = (textAnchor, text) => {
    if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
        return '';
    }

    // First shard in document doesn't have startIndex property
    const startIndex = textAnchor.textSegments[0].startIndex || 0;
    const endIndex = textAnchor.textSegments[0].endIndex;

    return text.substring(startIndex, endIndex);
};

// Generar las preguntas basadas en el los bloques de información
export const generarPreguntas = async (req, res) => {
    try {

        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes
        const output = {preguntas_respuestas: ""}


        // Plantilla para el promt
        const PLANTILLA_PREGUNTADOR = `(En español) Eres un profesor de bachillerato con años de experiencia y estás preparando preguntas para un exámen,
        genera {numeroPreguntas} preguntas cortas sobre el contexto proporcionado y sus respectivas respuestas sacadas literalmente de este contexto.
        
        El formato de la pregunta y su respuesta debe ser como el de los siguientes ejemplos:
        
        <Pregunta ejemplo 1> 
        ¿Qué rey firmó los Decretos de Nueva Planta?
        </Pregunta ejemplo 1>
        <Repuesta ejemplo 1>
        El rey Felipe V.
        </Repuesta ejemplo 1>
        
        <Pregunta ejemplo 2> En la segunda fase ocurrió el primer bombardeo aéreo civil de la historia. ¿En qué población vasca? </Pregunta ejemplo 2>
        <Respuesta ejemplo 2> En Guernica </Respuesta ejemplo 2>
        
        <Pregunta ejemplo 3> 
        ¿Durante qué periodo histórico se desarrolló la Primera República Española?
        </Pregunta ejemplo 3>
        <Respuesta ejemplo 3> 
        La I República se desarrolló entre 1873 y 1874, al final del periodo conocido como Sexenio Revolucionario o Democrático. 
        </Respuesta ejemplo 3>
        
        <Pregunta ejemplo 4> 
        ¿A qué país se enfrentó España durante la guerra colonial de Cuba?
        </Pregunta ejemplo 4>
        <Respuesta ejemplo 4> 
        A Estados Unidos.
        </Respuesta ejemplo 4>
        
        <Pregunta ejemplo 5> 
        ¿Qué político español fue responsable de la desamortización durante el bienio progresista? 
        </Pregunta ejemplo 5>
        <Respuesta ejemplo 5> 
        Pascual Madoz.
        </Respuesta ejemplo 5>

        <Pregunta ejemplo 6> 
        ¿Qué obra de Azorín sugiere que España comenzaría a recuperarse con un ejercicio de voluntad colectivo? 
        </Pregunta ejemplo 6>
        <Respuesta ejemplo 6> 
        La voluntad.
        </Respuesta ejemplo 6>
        
        Usa una redacción corta y sencilla, genera las {numeroPreguntas} preguntas lo más ajustadas posible al siguiente contexto.
        
        <contexto>
        
        {contexto}
        
        </contexto>`;
        
        // Carga modelo ejecutandose en Ollama
        const model = new ChatOpenAI({
            temperature: 0.2,
            modelName: 'gpt-4o',
            // modelName: 'gpt-3.5-turbo-0125'
        });

        // Cargar plantilla del promt
        const promtPreguntador = ChatPromptTemplate.fromTemplate(
            PLANTILLA_PREGUNTADOR
        );
        
        // Cadena de ejecución de modulos: Se pasa el promt al modelo y la respuesta se transforma a String
        const cadenaPreguntador = RunnableSequence.from([
            promtPreguntador,
            model,
            new StringOutputParser()
        ]);

        // Genera y almacena las preguntas del primer bloque
        console.log("Generando preguntas del bloque", 0)
        await generarBloque(0, bloquesRelevantes, output, cadenaPreguntador)

        // Devuelve los bloques con las preguntas del primer bloque generadas, para que se pueda empezar a usar la aplicación mientras se generan el resto
        res.json({ 
            mensaje: 'Preguntas generadas correctamente',
            bloquesRelevantes: bloquesRelevantes
        })

        // Genera y almacena el resto de las preguntas para cada bloque 
        for (let cnt = 1; cnt < bloquesRelevantes.length; cnt++){
            console.log("Generando preguntas del bloque", cnt)
            generarBloque(cnt, bloquesRelevantes, output, cadenaPreguntador)
        }
    } catch (error) {
        console.log('Error al generar las preguntas:', error);
        res.status(500).json({ mensaje: 'Error al generar las preguntas' });
    }
}

// Función auxiliar para generarPreguntas: genera las preguntas para el numero de bloque específico que se le indique
const generarBloque = async function (numBloque, bloquesRelevantes, output, cadenaPreguntador) {
    try {
        const numeroPreguntas = Number(bloquesRelevantes[numBloque][0].length*2/300).toFixed(0)
        console.log("Numero preguntas",numeroPreguntas)
        // Generar las preguntas del bloque seleccionado
        output.preguntas_respuestas = await cadenaPreguntador.invoke({
            contexto: bloquesRelevantes[numBloque][0],
            numeroPreguntas: numeroPreguntas
        });

        // Imprime por consola cuando se han terminado de generar las preguntas
        var timestamp = new Date();
        console.log("Preguntas bloque " + numBloque + " generadas (" + timestamp.toLocaleTimeString() + ")")

        const preguntas_respuestas = output.preguntas_respuestas;
        
        // Patrones para extraer las preguntas y respuestas de la respuesta de la IA
        const regexInicioPregunta = /<Pregunta \d>/g;
        const regexFinPregunta = /<\/Pregunta \d>/g;
        const regexInicioRespuesta = /<Respuesta \d>/g;
        const regexFinRespuesta = /<\/Respuesta \d>/g;
    
        const preguntasRespuestasObj = {};
    
        let inicioPregunta;
        let indicePregunta = 1;
    
        // Guarda las preguntas y respuestas conjuntamente en objetos dentro de bloquesRelevantes
        while ((inicioPregunta = regexInicioPregunta.exec(preguntas_respuestas)) !== null) {
            const indiceFinPregunta = regexFinPregunta.exec(preguntas_respuestas);
            const pregunta = preguntas_respuestas.substring(inicioPregunta.index + 13, indiceFinPregunta.index - 1);
        
            // Buscar la respuesta correspondiente
            let inicioRespuesta = regexInicioRespuesta.exec(preguntas_respuestas);
            const indiceFinRespuesta = regexFinRespuesta.exec(preguntas_respuestas).index;
            const respuesta = preguntas_respuestas.substring(inicioRespuesta.index + 14, indiceFinRespuesta - 1);
        
            preguntasRespuestasObj[`pregunta${indicePregunta}`] = {
                pregunta: pregunta,
                respuesta: respuesta,
                done: false,
                evaluacion: 'nA'
            };
        
            bloquesRelevantes[numBloque][indicePregunta] = preguntasRespuestasObj[`pregunta${indicePregunta}`]
        
            indicePregunta++;
        }

        await Bloques.findOneAndUpdate({id:1},{bloquesRelevantes:bloquesRelevantes},{new: true})

        // Imprime por consola cuando se han almacenado correctamente todas las preguntas
        timestamp = new Date();
        console.log("Preguntas bloque " + numBloque + " almacenadas (" + timestamp.toLocaleTimeString() + ")")
    } catch (error) {
        console.log('Error al generar las preguntas del bloque ' + numBloque + ':', error);
    }
}

// Devuelve un bloque específico específicado a través del parametro numBloque
export const getPreguntas = async (req, res) => {
    try {
        const { numBloque } = req.params;
        const db = await Bloques.findOne({id: 1})
        const listaPreguntas = db.bloquesRelevantes[numBloque]
        res.json(listaPreguntas);
    } catch (error) {
        console.log('Error al obtener las preguntas:', error);
        res.status(500).json({ mensaje: 'Error al obtener las preguntas:' });
    }  
}

// Devuelve la siguiente pregunta que no haya sido respondida todavía
export const siguientePregunta = async (req, res) => {
    try {
        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes
        let i = 0, j = 1;
        let siguientePregunta = ''
        while (siguientePregunta == '' && i < bloquesRelevantes.length) {
            j = 1;
            while(siguientePregunta == '' && j < bloquesRelevantes[i].length){
                if(!bloquesRelevantes[i][j].done){
                    siguientePregunta = bloquesRelevantes[i][j]
                }
                j++;
            }
            i++;
        }
        if(siguientePregunta == '') siguientePregunta = "nA";
        const numBloque = i-1
        const numPregunta = j-1
        res.json({conjuntoPregunta: siguientePregunta, numBloque: numBloque, numPregunta: numPregunta})
    } catch (error) {
        console.log('Error al obtener la siguiente pregunta:', error);
        res.status(500).json({ mensaje: 'Error al obtener la siguiente pregunta:' });
    }
}

// Evalua la respuesta del usuario comparando su vectorización con el de la respuesta del LLM (NO SE USA)
export const evaluarVectores = async (req, res) => {
    try {
        const {respuesta_usuario, respuesta_LLM, numBloque, numPregunta} = req.body;

        const embeddings = new OpenAIEmbeddings({
            modelName:'text-embedding-3-large'
        });

        const vector_LLM = await embeddings.embedQuery(respuesta_LLM)
        const vector_usuario = await embeddings.embedQuery(respuesta_usuario) 

        let similitud = similarity.cosine(vector_LLM, vector_usuario)

        console.log("Similitud vectores:",similitud)

        let evaluacion;

        if (similitud > 0.65) {
            evaluacion = 'Correcta';
        } else if (0.40 <= similitud && similitud <= 0.65) {
            evaluacion = 'Mejorable';
        } else {
            evaluacion = 'Incorrecta';
        }

        // Actualizamos evaluación de esa pregunta a base de datos
        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes
        bloquesRelevantes[numBloque][numPregunta].evaluacion = evaluacion
        await Bloques.findOneAndUpdate({id: 1},{bloquesRelevantes: bloquesRelevantes},{new: true})

        console.log('La respuesta es', evaluacion);
        console.log('Repuesta original:', respuesta_LLM)

        res.json({evaluacion: evaluacion, respuesta_correcta: respuesta_LLM});
    } catch (error) {
        console.error('Error al evaluar la respuesta mediante comparación de vectores:', error);
        res.status(500).json({ mensaje: 'Error al evaluar la respuesta mediante comparación de vectores:' });
    }  
    
}

// Realiza una nueva llamada al LLM para comparar la respuesta del usuario con la del propio LLM
export const evaluarLLM = async (req, res) => {
    try {
        const {respuesta_usuario, respuesta_LLM, numBloque, numPregunta} = req.body;

        const model = new ChatOpenAI({
            temperature: 0.2,
            modelName: 'gpt-4o'
            // modelName: 'gpt-3.5-turbo-0125'
        });

        const PLANTILLA_EVALUADOR = `(En español)Eres un asistente virtual que tiene que evaluar la respuesta de un usuario a una pregunta concreta. 
        Para hacer la evaluación de la respuesta tienes que comparar la "respuesta correcta" con la "respues del usuario". 
        
        <respuesta correcta>
        {respuesta_correcta}
        </respuesta correcta>
        <respuesta del usuario>
        {respuesta_usuario}
        </respuesta del usuario>
        
        El resultado de tu evaluación tendrá tres posibles resultados: 
        Opcion 1: "Correcta" si coinciden o son parecidas la "respuesta correcta" con la "respuesta del usuario"
        Opcion 2: "Mejorable" si se parece la "respuesta correcta" con la "respuesta del usuario" pero está incompleta
        Opcion 3: "Incorrecta" si no coinciden o no se parecen la "respuesta correcta" con la "respuesta del usuario"
        Se generoso, si la "respuesta del usuario" contiene la información esencial dentro de la "respuesta correcta", debe ser evaluada como correcta
        
        La evaluación debe aparecer bajo el siguiente formato:
        <evaluación>
        "Tu evaluación"
        </evaluación>
        
        Aqui te dejo algunos ejemplos de como debería ser la evaluación de cada "respuesta del usuario" dada la "respuesta correcta" en cada caso:
        
        EJEMPLO 1:
        <respuesta correcta>
        Alemania, Italia y Portugal.
        </respuesta correcta>
        <respuesta del usuario>
        Alemania e Italia
        </respuesta del usuario>
        
        RESULTADO:
        <evaluación>
        Mejorable
        </evaluación>
        
        EJEMPLO 2:
        <respuesta correcta>
        El estallido de la Guerra Civil en 1936.
        </respuesta correcta>
        <respuesta del usuario>
        La guerra civil
        </respuesta del usuario>
        
        RESULTADO:
        <evaluación>
        Correcta
        </evaluación>
        
        EJEMPLO 3:
        <respuesta correcta>
        La Cornisa Cantábrica, Levante y Madrid.
        </respuesta correcta>
        <respuesta del usuario>
        Madrid, levante y la cornisa cantabrica.
        </respuesta del usuario>
        
        RESULTADO:
        <evaluación>
        Correcta
        </evaluación>
        
        EJEMPLO 4:
        <respuesta correcta>
        Gran cantidad de armamento y una valiosa asistencia técnica y logística a cambio de las reservas de oro del Banco de España y un aumento de su influencia política y del PCE.
        </respuesta correcta>
        <respuesta del usuario>
        Armamento y asistencia técnica y logística
        </respuesta del usuario>
        
        RESULTADO:
        <evaluación>
        Correcta
        </evaluación>
        
        EJEMPLO 5:
        <respuesta correcta>
        El general Mola.
        </respuesta correcta>
        <respuesta del usuario>
        Franco
        </respuesta del usuario>
        
        RESULTADO:
        <evaluación>
        Incorrecta
        </evaluación>
        
        EJEMPLO 6:
        <respuesta correcta>
        El general Mola.
        </respuesta correcta>
        <respuesta del usuario>
        Mola
        </respuesta del usuario>
        
        RESULTADO:
        <evaluación>
        Correcta
        </evaluación>`

        const promtEvaluador = ChatPromptTemplate.fromTemplate(
            PLANTILLA_EVALUADOR
        );

        const cadenaEvaluador = RunnableSequence.from([
            promtEvaluador,
            model,
            new StringOutputParser()
        ]);

        console.log("\n---- EVALUADOR ----")

        let evaluacion = await cadenaEvaluador.invoke({
            respuesta_correcta: respuesta_LLM,
            respuesta_usuario: respuesta_usuario
        });

        console.log(evaluacion)

        const regexInicioEvaluacion = /<evaluación>/g;
        const regexFinEvaluacion = /<\/evaluación>/g;

        const indiceEvaluacion = regexInicioEvaluacion.exec(evaluacion)
        const indiceFinEvaluacion = regexFinEvaluacion.exec(evaluacion)
        const evaluacionFinal = evaluacion.substring(indiceEvaluacion.index + 13, indiceFinEvaluacion.index - 1)

        console.log("\n---- EVALUACIÓN FINAL ----")
        console.log(evaluacionFinal)

        // Actualizamos evaluación de esa pregunta a base de datos
        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes
        bloquesRelevantes[numBloque][numPregunta].evaluacion = evaluacionFinal
        await Bloques.findOneAndUpdate({id: 1},{bloquesRelevantes: bloquesRelevantes},{new: true})

        res.json({evaluacion: evaluacionFinal, respuesta_correcta: respuesta_LLM});
    } catch (error) {
        console.error('Error al evaluar la respuesta mediante LLM:', error);
        res.status(500).json({ mensaje: 'Error al evaluar la respuesta mediante LLM:' });
    }
}

// Marca una pregunta específica como "hecha"
export const marcarPregunta = async (req, res) => {
    try{
        const {numBloque, numPregunta} = req.body
        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes
        bloquesRelevantes[numBloque][numPregunta].done = true
        await Bloques.findOneAndUpdate({id: 1},{bloquesRelevantes: bloquesRelevantes},{new: true})
        res.json("Pregunta marcada como hecha")
    } catch (error) {
        console.error('Error al marcar la pregunta:', error);
        res.status(500).json({ mensaje: 'Error al marcar la pregunta:' });
    }
}

// Marca todas las preguntas como "no hechas"
export const reiniciarPreguntas = async (req, res) => {
    try{
        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes

        let i = 0
        while (i < bloquesRelevantes.length && bloquesRelevantes[i][1] != "") {
            let j = 1
            while(j < bloquesRelevantes[i].length){
                bloquesRelevantes[i][j].done = false;
                bloquesRelevantes[i][j].evaluacion = "nA"
                j++;
            }
            i++;
        }

        await Bloques.findOneAndUpdate({id: 1},{bloquesRelevantes: bloquesRelevantes},{new: true})
        res.send("Preguntas reiniciadas")
    } catch (error) {
        console.error('Error al reiniciar las preguntas:', error);
        res.status(500).json({ mensaje: 'Error al reiniciar las preguntas:' });
    }
}

// Calcula la nota media de todas las preguntas respondidas
export const calcularNota = async (req, res) => {
    try{
        const db = await Bloques.findOne({id: 1})
        const bloquesRelevantes = db.bloquesRelevantes

        let i = 0, nota = 0, cnt = 0, correctas = 0, mejorables = 0, incorrectas = 0
        while (i < bloquesRelevantes.length && bloquesRelevantes[i][1] != "") {
            let j = 1
            while(j < bloquesRelevantes[i].length){
                if (bloquesRelevantes[i][j].done) {
                    switch (bloquesRelevantes[i][j].evaluacion) {
                        case 'Correcta':
                            nota += 1;
                            correctas++;
                            cnt++
                            break;
                        case 'Mejorable':
                            nota += 0.5;
                            mejorables++;
                            cnt++
                            break;
                        case 'Incorrecta':
                            incorrectas++
                            cnt++
                            break;
                        default:
                    }
                }
                j++;
            }
            i++;
        }
        const notaFinal = Number((nota*10)/cnt).toFixed(2)
        const perCorrectas = Number((correctas*100)/cnt).toFixed(0)
        const perMejorables = Number((mejorables*100)/cnt).toFixed(0)
        const perIncorrectas = Number((incorrectas*100)/cnt).toFixed(0)
        res.json({notaFinal: notaFinal, correctas: perCorrectas, mejorables: perMejorables, incorrectas: perIncorrectas})
    } catch (error) {
        console.error('Error al calcular la nota final:', error);
        res.status(500).json({ Error: 'Error al calcular la nota final:' });
    }
}

// Convierte un archivo de audio a texto con Google Cloud
export const speechToTextGoogle = async (req, res) => {
    try{
        const client = new SpeechClient();
        const { audioContent } = req.body    

        // Función de llamada a la API
        async function quickstart() {

            // Contenido del audio
            const audio = {
                content: audioContent,
            };


            // Configuración de la API
            const config = {
                encoding: 'MP3',
                sampleRateHertz: 44100,
                languageCode: 'es-ES',
                audioChannelCount: 1
            };            

            return new Promise((resolve, reject)=>{
                client.recognize({audio,config})
                .then(data=>{
                    resolve(data);
                })
                .catch(error=>{
                    reject(error);
                })
            })
        }

        const response = await quickstart();
        const transcript = response[0].results.map(r=>r.alternatives[0].transcript).join('\n')
        console.log("Texto del audio:", transcript)

        res.json({respuestaUsuario: `${transcript}`})
    } catch (error) {
        console.error('Error al pasar el audio a texto:', error);
        res.status(500).json({ Error: 'Error al pasar el audio a texto' });
    }
}