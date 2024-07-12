import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ScrollView, Text, View, TextInput, Alert, ActivityIndicator, Platform, TouchableOpacity  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../components/CustomButton';
import {API_HOST, OPENAI_API_KEY, GOOGLE_SPEECH_API_KEY} from "@env";
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { Image } from 'expo-image';
// import RNFS from 'react-native-fs'

const Pregunta = () => {
  const [respuesta_LLM, setRespuestaLLM] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [numBloque, setNumBloque] = useState('');
  const [numPregunta, setNumPregunta] = useState('');
  const [evaluacion, setEvaluacion] = useState('');
  const [respuesta_usuario, setRespuestaUsuario] = useState('')
  const [esFinalizable, setEsfinalizable] = useState(true)
  const [evaluando, setEvaluando] = useState(false)

  const [recording, setRecording] = useState(null);
  const [loadingTransc, setLoadingTransc] = useState(false);

  useEffect( () => {
    getSiguientePregunta(); 
    puedeFinalizar();
  }, []);

  const getSiguientePregunta = async () => {
    try{
      Speech.stop()

      const response = await axios.get(`${API_HOST}/siguientePregunta`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "multipart/form-data",
        }
      });

      console.log(response.data.conjuntoPregunta)

      if(response.data.conjuntoPregunta === "nA") {
        router.push('/final');
      }

      setRespuestaLLM(response.data.conjuntoPregunta.respuesta)
      setPregunta(response.data.conjuntoPregunta.pregunta)
      setNumBloque(response.data.numBloque)
      setNumPregunta(response.data.numPregunta)
      
      console.log("Siguiente pregunta:")
      console.log(response.data.conjuntoPregunta)

      speak(response.data.conjuntoPregunta.pregunta);
    } catch (err) {
      console.error("Error obteniendo la siguiente pregunta", err)
    }
  }

  const evaluarRespuesta = async () => {
    try{
      setEvaluando(true)

      // console.log(respuesta_usuario,respuesta_LLM,numBloque,numPregunta)
      const body = {
        respuesta_usuario: respuesta_usuario,
        respuesta_LLM: respuesta_LLM,
        numBloque: numBloque,
        numPregunta: numPregunta
      };

      const response = await axios.post(`${API_HOST}/evaluarLLM`,body,{
        headers: {
          Accept: "application/json"
        }
      });

      setEvaluando(false)
      setEvaluacion(response.data.evaluacion)

      console.log(response.data)
    } catch (err) {
      console.error("Error evaluando respuesta", err)
    }
  }

  const pasarPregunta = async () => {
    try {
      Speech.stop();

      const body = {
        numBloque: numBloque,
        numPregunta: numPregunta
      };

      await axios.post(`${API_HOST}/marcarPregunta`,body,{
        headers: {
          Accept: "application/json"
        }
      });

      router.push('/pregunta')

      console.log("Pasando la pregunta")
    } catch (error) {
      console.error("Error al pasar la pregunta")
    }
  }

  const puedeFinalizar = async () => {
    try{
        const response = await axios.get(`${API_HOST}/calcularNota`,{
        headers: {
            Accept: "application/json"
        }
        });

        const notaFinal = await response.data.notaFinal

        if ( notaFinal === "NaN") {
          setEsfinalizable(false);
        } 
    } catch (err) {
        console.error("Error comprobando si es posible finalizar la lección", err)
    }
  } 

  const startRecording = async () => {
    try {
      Speech.stop()

      console.log('Solicitando permiso para el micrófono');
      const permission = await Audio.requestPermissionsAsync();

      // Comenzar a grabar audio solo si se ha dado permiso para usar el micrófono
      if (permission.status === "granted") {
        console.log('Comenzando grabación');

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
              extension: '.mp3',
              outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
              audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
              sampleRate: 44100,
              numberOfChannels: 1,
              bitRate: 128000,
          },
          ios: {
              extension: '.mp3',
              audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
              sampleRate: 44100,
              numberOfChannels: 1,
              bitRate: 128000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
          },
        });

        await recording.startAsync();

        setRecording(recording);
        console.log('Grabación comenzada');
      } else {
        console.warn("Es necesario permitir la grabación de audio para esta función")
      }
    } catch (err) {
      console.error('Error al iniciar la grabación', err);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Parando grabación');
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      setLoadingTransc(true)
      setRecording(undefined)
      await transcribeAudio(uri); 
      setLoadingTransc(false)
    } catch (error) {
      console.error("Error al parar de grabar", error)
    }
  };

  const transcribeAudio = async (uri) => {
    try {

      // Codifica el archivo en base64
      const base64Content = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log("Enviando audio a Cloud Speech To Text")
      const response = await axios.post(`${API_HOST}/speechToTextGoogle`, {
        audioContent: base64Content
      },{
        headers: {
          Accept: "application/json"
        }
      });

      const result = response.data;
      console.log('Transcripción:',result)
      setRespuestaUsuario(result.respuestaUsuario);
    } catch (error) {
      console.error('Error transcribing audio:', error);
    }
  };

  const speak = async (preguntaActual) => {
    
    Speech.speak(preguntaActual,{
      // language:"es-ES",
      voice:"es-es-x-eed-network" 
      // voice: "es-es-x-eef-local" // Hombre grave
      // voice:"es-es-x-eec-network" // Mujer no robotica
    });

    // const voces = await Speech.getAvailableVoicesAsync()

    // console.log(voces)
  };

  const recordingAlert = async () => {
    try {
      {
        Alert.alert("Grabación en curso","Finalice la grabación en curso antes de realizar esta acción",
        [
          {
            text: "Entendido",
            onPress: () => {},
          }
        ],{
          cancelable: true
        })
      }
    } catch (error) {
      console.error('Error al alertar la grabación en curso:', error)
    }
  }

  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView contentContainerStyle={{flexGrow: 1}}>
        <View className="w-full h-full px-4 items-center justify-center">
          { evaluando ? (
              <View className='mb-16'>
                <Text className="font-pregular text-gray-100 text-center mt-10 ">Evaluando tu respuesta</Text>
                <ActivityIndicator className="mt-10" size="50" color="bg-secondary" />
              </View>
            ): null
          }
          {evaluacion === "Correcta" && <Text className="text-3xl font-pblack text-green-400 mb-7">{evaluacion}</Text>}
          {evaluacion === "Mejorable" && <Text className="text-3xl font-pblack text-yellow-400 mb-7">{evaluacion}</Text>}
          {evaluacion === "Incorrecta" && <Text className="text-3xl font-pblack text-red-500 mb-7">{evaluacion}</Text>}
          {evaluacion !== "" && 
            <View className="items-center">
              <Text className="text-xl font-pblack text-gray-300 mb-2 items-start">Respuesta correcta:</Text>
              <Text className="text-xl font-pblack text-gray-300 mb-16 items-start">{respuesta_LLM}</Text>
            </View>
          }
          <Text className="text-xl font-pblack text-white mt-5">{pregunta}</Text>
          <View className="w-full h-12 mt-10 flex-row items-center" style={{ backgroundColor: 'white', borderRadius: 20, paddingLeft: 10 }}>
            <TextInput
              editable
              maxLength={200}
              className="text-base flex-1 font-pregular"
              value={respuesta_usuario}
              onChangeText={setRespuestaUsuario}
            />
            { loadingTransc ? 
              <ActivityIndicator size="large" style={{ width: 35, height: 35, marginRight: 10, marginLeft: 5 }} color="black" />
              :
              <TouchableOpacity onPress={recording ? stopRecording : startRecording}>
              <Image source={recording ? require('../iconos/pararGrabacion.png') : require('../iconos/microfono.png')} style={{ width: 35, height: 35, marginRight: 10, marginLeft: 5 }} />
              </TouchableOpacity>
            }
            
          </View>
          {respuesta_usuario === "" && evaluacion === "" &&
          <View className="w-full">
            <CustomButton
                title="Pasar pregunta"
                handlePress={recording ? recordingAlert : pasarPregunta}
                containerStyles="w-full mt-4"
                color={"bg-cyan-600"}
              />
          </View>
          }
          {respuesta_usuario !== "" && evaluacion === "" &&
          <View className="w-full">
            <CustomButton
                title="Enviar respuesta"
                handlePress={recording ? recordingAlert : evaluarRespuesta}
                containerStyles="w-full mt-4"
                color={"bg-secondary"}
              />
          </View>
          }
          {evaluacion === "" && 
            <View className="w-full">
              {/* <CustomButton
                title={recording ? 'Dejar de grabar' : 'Comenzar grabación'}
                handlePress={recording ? stopRecording : startRecording}
                containerStyles="w-full mt-4"
                color={"bg-secondary"}
              /> */}
              {/* <CustomButton
                title="Escuchar pregunta"
                handlePress={speak}
                containerStyles="w-full mt-4"
                color={"bg-secondary"}
              /> */}
              {esFinalizable ? (
                <CustomButton
                    title="Finalizar sesión"
                    handlePress={recording ? recordingAlert : () =>{
                        Alert.alert("Finalizar sesión","¿Desea finalizar la sesión y visualizar los resultados?",
                        [
                          {
                            text: "Cancelar",
                            onPress: () => {},
                          },
                          {
                            text: "Finalizar",
                            onPress: () => {
                              Speech.stop();
                              router.push('/final')
                            }
                          }
                        ],{
                          cancelable: true
                        })
                      }
                    }
                    containerStyles="w-full mt-4"
                    color={"bg-red-400"}
                />
              ) : null}
            </View>
          }{evaluacion !== "" && 
            <CustomButton
                title="Siguiente pregunta"
                handlePress={recording ? recordingAlert : pasarPregunta}
                containerStyles="w-full mt-4"
                color={"bg-cyan-600"}
            />
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default Pregunta