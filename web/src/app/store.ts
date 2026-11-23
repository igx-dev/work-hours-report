import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { api, type ThunkExtra } from '../api/api';
import { uiSlice } from './uiSlice';

export function makeStore(extra: ThunkExtra) {
  return configureStore({
    reducer: { [api.reducerPath]: api.reducer, ui: uiSlice.reducer },
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: extra } }).concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export const useAppDispatch = useDispatch.withTypes<AppStore['dispatch']>();
export const useAppSelector = useSelector.withTypes<RootState>();
