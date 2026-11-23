/** 画面をまたいで覚えておく状態: 選んでいる月。 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { currentMonth } from '../lib/dates';

export const uiSlice = createSlice({
  name: 'ui',
  initialState: { month: currentMonth() },
  reducers: {
    setMonth(state, action: PayloadAction<string>) {
      state.month = action.payload;
    },
  },
});

export const { setMonth } = uiSlice.actions;
