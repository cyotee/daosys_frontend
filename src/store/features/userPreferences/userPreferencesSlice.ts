import { createSlice } from "@reduxjs/toolkit";
import { produce } from "immer";

export interface UserPreferencesState {
    theme: string,
    selectedCollection: string | undefined,
    selectedTab: string,
}

export const initialState: UserPreferencesState = {
    theme: 'dark',
    selectedCollection: '',
    selectedTab: 'new',
}

export const userPreferencesSlice = createSlice({
    name: 'userPreferences',
    initialState,
    reducers: {
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        setSelectedCollection: (state, action) => {
            state.selectedCollection = action.payload;
        },
        setSelectedTab: (state, action) => {
            state.selectedTab = action.payload.id;
        }
    }
});

export const { setTheme, setSelectedCollection, setSelectedTab } = userPreferencesSlice.actions;

export default userPreferencesSlice.reducer;
