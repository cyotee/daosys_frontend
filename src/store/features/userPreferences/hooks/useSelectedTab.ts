import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useCallback, useMemo } from "react";
import { setSelectedTab } from "../userPreferencesSlice";

export const useSelectedTab = () => {
    const selectedTab = useAppSelector((state) => state.userPreferencesSlice.selectedTab);

    const dispatch = useAppDispatch();

    const selectTab = useCallback((tab: string) => {
        dispatch(setSelectedTab({ id: tab }));
    }, [dispatch]);

    return useMemo(() => ({
        selectedTab,
        selectTab
    }), [selectedTab, selectTab]);
}

export default useSelectedTab;