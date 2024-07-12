import { SplashScreen, Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { useEffect } from 'react';

// Evita que la splash screen se encuentre antes de que carguen las assets
SplashScreen.preventAutoHideAsync();

const RootLayout = () => {
    const [fontsLoaded, error] = useFonts({
        "Poppins-Black": require("../assets/fonts/Poppins-Black.ttf"),
        "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
        "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
        "Poppins-ExtraLight": require("../assets/fonts/Poppins-ExtraLight.ttf"),
        "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
        "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
        "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
        "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
        "Poppins-Thin": require("../assets/fonts/Poppins-Thin.ttf"),
    });

    // Comprobar que se cargan bien las fuentes y esconder SplashScreen
    useEffect(() => {
        if (error) throw error;
        if (fontsLoaded) SplashScreen.hideAsync(); 
    }), [fontsLoaded, error] // Array de dependencias

    if(!fontsLoaded && !error) return null;

    //Renders current child route
    return (
        // Declarar cada pantalla de manera individual
        <Stack>
            <Stack.Screen name = "index" options={{
                headerShown: false,
                statusBarColor: "#161622",
                statusBarStyle: "light",
                animation: 'slide_from_left'
            }}/>
            <Stack.Screen name = "pregunta" options={{
                headerShown: false,
                animation: 'slide_from_right',
                statusBarColor: "#161622",
                statusBarStyle: "light"
            }}/>
            <Stack.Screen name = "final" options={{
                headerShown: false,
                animation: 'slide_from_bottom',
                statusBarColor: "#161622",
                statusBarStyle: "light"
            }}/>
        </Stack>
    )
}

export default RootLayout