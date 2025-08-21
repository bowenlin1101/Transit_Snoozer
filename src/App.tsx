import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './store';
import { RootStackParamList } from './types';
import HomeScreen from './screens/HomeScreen';
import ActiveRouteScreen from './screens/ActiveRouteScreen';
import SettingsScreen from './screens/SettingsScreen';
import PermissionsScreen from './screens/PermissionsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#4CAF50',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}>
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="ActiveRoute" 
              component={ActiveRouteScreen}
              options={{ title: 'Active Route' }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen 
              name="Permissions" 
              component={PermissionsScreen}
              options={{ title: 'Permissions' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;