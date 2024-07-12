import { ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../components/CustomButton';
import { useState, useEffect } from 'react';
import axios from 'axios';
import {API_HOST} from "@env";

const final = () => {

    const [notaFinal, setNotaFinal] = useState('')
    const [correctas, setCorrectas] = useState('')
    const [mejorables, setMejorables] = useState('')
    const [incorrectas, setIncorrectas] = useState('')

    useEffect( () => {calcularNota()}, []);
    
    const calcularNota = async () => {
        try{
            const response = await axios.get(`${API_HOST}/calcularNota`,{
            headers: {
                Accept: "application/json"
            }
            });

            setNotaFinal(await response.data.notaFinal)
            setCorrectas(response.data.correctas)
            setMejorables(response.data.mejorables)
            setIncorrectas(response.data.incorrectas)

            console.log("Nota final",response.data.notaFinal)
        } catch (err) {
            console.error("Error evaluando respuesta", err)
        }
    }    
    
    const reiniciarLeccion = async () => {
        try{
            await axios.get(`${API_HOST}/reiniciarPreguntas`,{
            headers: {
                Accept: "application/json"
            }
            });

            console.log("Reiniciando lección")

            router.push('/pregunta')
        } catch (err) {
            console.error("Error reiniciando la lección", err)
        }
    }

  return (
    <SafeAreaView className="bg-primary h-full">
        <ScrollView contentContainerStyle={{flexGrow: 1}}>
        <View className="px-4 h-1/4 w-full items-center justify-center">
            {notaFinal > 7.5 && <Text className="text-6xl font-pblack text-green-400" style={{lineHeight:300}}>{notaFinal}
            <Text className="text-6xl font-pblack text-gray-300" style={{lineHeight:300}}>/10</Text></Text>}
            {notaFinal >= 5 && notaFinal <= 7.5 && <Text className="text-6xl font-pblack text-yellow-400" style={{lineHeight:300}}>{notaFinal}
            <Text className="text-6xl font-pblack text-gray-300" style={{lineHeight:300}}>/10</Text></Text>}
            {notaFinal < 5 && <Text className="text-6xl font-pblack text-red-500" style={{lineHeight:300}}>{notaFinal}
            <Text className="text-6xl font-pblack text-gray-300" style={{lineHeight:300}}>/10</Text></Text>}
        </View>
        <View className="px-4 h-3/4 items-center justify-center">
            <Text className="text-4xl font-pbold text-green-400" style={{lineHeight:80}}>Correctas:  {correctas}%</Text>
            <Text className="text-4xl font-pbold text-yellow-400" style={{lineHeight:80}}>Mejorables:  {mejorables}%</Text>
            <Text className="text-4xl font-pbold text-red-500" style={{lineHeight:80}}>Incorrectas:  {incorrectas}%</Text>
            <CustomButton
                title="Reiniciar sesión"
                handlePress={reiniciarLeccion}
                containerStyles="w-full mt-8"
                color={"bg-emerald-400"}
            />
            <CustomButton
                title="Volver al inicio"
                handlePress={() => router.push('/')}
                containerStyles="w-full mt-3"
                color={"bg-secondary"}
            />
        </View>
        </ScrollView>
    </SafeAreaView>
  )
}

export default final