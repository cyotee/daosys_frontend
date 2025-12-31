'use client'

import React, { useCallback, useEffect, useState } from 'react';
import { NextPage } from 'next';
import { TabWithClose } from '@/components/TabWithClose';
import { Grid, Tab, Tabs } from '@mui/material';
import { TabViewer } from '@/store/features/tabs/components/TabViewer';
import { TabsSkeleton } from '@/components/Skeletons';
import { Add } from '@mui/icons-material';
import useTabs from '@/store/features/tabs/hooks/useTabs';
import useSelectedTab from '@/store/features/userPreferences/hooks/useSelectedTab';

const Home: NextPage = () => {
  const [mounted, setMounted] = useState(false);

  const {
    selectTab: setTab,
    selectedTab
  } = useSelectedTab();

  const {
    newTab,
    tabs,
    removeTab
  } = useTabs();

  const [tabId, setTabId] = useState<string | undefined | number>('new');

  useEffect(() => {
    setMounted(true);
  }, []);



  const handleTabIdUpdate = useCallback(() => {
    const targetTab = tabs.filter(tab => tab.id === selectedTab);

    if (targetTab.length > 0) {
      setTabId(tabs.indexOf(targetTab[0]));
    } else if (tabs.length > 0) {
      // selectedTab doesn't match any tab - select the first available tab
      setTabId(0);
      setTab(tabs[0].id);
    } else {
      setTabId('new');
    }
  }, [selectedTab, tabs, setTab])

  const handleNewTab = useCallback(() => {
    const newId = newTab();  // newTab now returns UUID string
    setTab(newId);  // Set selected tab to the new tab's UUID directly
    console.log('handleNewTab', newId);
  }, [newTab, setTab]);


  useEffect(() => {
    handleTabIdUpdate();
    console.log('effect:handleTabIdUpdate');
  }, [handleTabIdUpdate]);




  // Show skeleton during SSR hydration
  if (!mounted) {
    return <TabsSkeleton />;
  }

  return (<>
    <Grid container gap={2}>
      <Grid item xs={12}>
        <Tabs
          sx={{
            mb: 4
          }}
          value={tabId}
          onChange={(e, v) => {
            console.log(v);
            tabs[v] && setTab(tabs[v].id);
          }}
          variant="scrollable"
          scrollButtons="auto"
        >

          {typeof tabs !== 'undefined' && tabs.map((tab, index) => {
            return <TabWithClose key={index} label={
              tab.title
            }
              canBeClosed={tabs.length > 1}
              onClickCloseIcon={() => {

                console.log('removeTab', tab.id);
                console.log('index', index);

                const leftTab = Object.keys(tabs).length > 0 ? Object.keys(tabs)[index - 1] : undefined;
                const rightTab = Object.keys(tabs).length > 0 ? Object.keys(tabs)[index + 1] : undefined;
                const navigateTo: number | string = leftTab ? leftTab : rightTab ? rightTab : 'new';
                setTabId(
                  navigateTo
                );
                removeTab(tab.id);
                // @ts-ignore
                setTab(tabs[navigateTo].id);
                handleTabIdUpdate();
              }}
              tabId={tab.id}
            />
          })}
          <Tab
            sx={{
              backgroundColor: (theme) => theme.palette.primary.main,
              color: (theme) => theme.palette.primary.contrastText,
            }}
            label='+' onClick={(e) => {
              e.preventDefault();
              handleNewTab();
            }} />
        </Tabs>
      </Grid>
    </Grid>


    <TabViewer tabId={selectedTab} />

  </>);
}

export default Home;
