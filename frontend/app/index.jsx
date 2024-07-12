import { ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../components/CustomButton';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import axios from 'axios';
import {API_HOST} from "@env";

export default function App() {

  const [isDocument, setIsDocument] = useState(false)
  const [procesandoDocumento, setProcesandoDocumento] = useState(false)
  const [generandoPreguntas, setGenerandoPreguntas] = useState(false)

  const selectDoc = async () => {
    try {
      const docRes = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf'
      });

      const formData = new FormData();   
      const assets = docRes.assets;
      if (!assets) return;

      const file = assets[0];

      const pdfFile = {
        name: file.name.split(".")[0]+".pdf",
        uri: file.uri,
        type: file.mimeType,
        size: file.size,
      };

      console.log(pdfFile.name)
      formData.append("myDocument", pdfFile);

      setProcesandoDocumento(true)

      const response = await axios.post(`${API_HOST}/procesarDocumento`, formData, {
        headers: {
          'Content-Type': "multipart/form-data",
        }
      });

      console.log(response.data.mensaje)

      setProcesandoDocumento(false)
      setIsDocument(true)

    } catch (err) {
      console.log("Error seleccionando un documento: ", err)
    }
  }

  const generarPreguntas = async () => {
    try {

    setGenerandoPreguntas(true)

    response = await axios.post(`${API_HOST}/generarPreguntas`, {
      headers: {
        Accept: "application/json"
      },
    });

    setGenerandoPreguntas(false)

    console.log(response.data.mensaje)

    router.push('/pregunta')
    } catch (error) {
      console.error("Error generando preguntas:", error)
    }
  }

  return (
    <SafeAreaView className="bg-primary h-full">{/* Ajusta la pantalla para que se vea bien en cualquier dispositivo */}
      <ScrollView contentContainerStyle={{flexGrow: 1}}>{/* Si la pantalla mide mas que el dispositivo permite que pueda deslizar */}
        <View className="w-full justify-center items-center h-full px-4">
          <Text className="text-6xl font-pblack text-white">TutorIA</Text>
          <Text className="font-pregular text-xl text-gray-100 text-center mt-5">Tu compañero de aprendizaje inteligente</Text>
          <CustomButton
          title="Subir documento"
          handlePress={selectDoc}
          containerStyles="w-full mt-10"
          color={"bg-secondary"}
          />
          {/* <CustomButton
          title="Ir a preguntas"
          handlePress={() => router.push('/pregunta')}
          containerStyles="w-full mt-1"
          color={"bg-secondary"}
          /> */}
          {
            isDocument ? (
            <View className="w-full mt-5">
              <Text className="font-pregular text-gray-100 text-center mt-5">Documento procesado correctamente</Text>
              <CustomButton
                title="Comenzar lección"
                handlePress={generarPreguntas}
                containerStyles="w-full mt-2"
                color={"bg-secondary"}
              />
            </View>
            ) : null
          }
          { procesandoDocumento ? (
            <View>
              <Text className="font-pregular text-gray-100 text-center mt-10">Fragmentando y procesando el documento</Text>
              <ActivityIndicator className="mt-10" size="50" color="bg-secondary" />
            </View>
            ) : null
          }
          { generandoPreguntas ? (
              <View>
                <Text className="font-pregular text-gray-100 text-center mt-10">Generando preguntas, este proceso puede tardar unos segundos</Text>
                <ActivityIndicator className="mt-10" size="50" color="bg-secondary" />
              </View>
            ) : null
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}