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
import { debugLog } from '@/utils/debug';

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

  useEffect(() => {
    setMounted(true);
  }, []);



  const handleNewTab = useCallback(() => {
    const newId = newTab();  // newTab now returns UUID string
    setTab(newId);  // Set selected tab to the new tab's UUID directly
    debugLog('handleNewTab', newId);
  }, [newTab, setTab]);




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
          value={selectedTab === 'new' ? false : selectedTab}
          onChange={(e, v) => {
            e.preventDefault();
            if (typeof v === 'string') setTab(v);
          }}
          variant="scrollable"
          scrollButtons="auto"
        >

          {typeof tabs !== 'undefined' && tabs.map((tab, index) => {
            return (
              <TabWithClose
                key={tab.id}
                value={tab.id}
                label={tab.title}
                canBeClosed={tabs.length > 1}
                onClickCloseIcon={() => {
                  const nextId = (() => {
                    if (tabs.length <= 1) return 'new';
                    if (index > 0) return tabs[index - 1].id;
                    return tabs[index + 1]?.id ?? 'new';
                  })();

                  removeTab(tab.id);
                  setTab(nextId);
                }}
                tabId={tab.id}
              />
            );
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
