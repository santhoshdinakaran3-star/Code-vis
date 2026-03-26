import { configureStore } from '@reduxjs/toolkit';
import visualizationReducer from './visualizationSlice';

export const store = configureStore({
    reducer: {
        visualization: visualizationReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
