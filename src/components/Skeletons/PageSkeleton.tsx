'use client';

import { Box, Skeleton, Grid } from '@mui/material';

export function TabsSkeleton() {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
        <Skeleton variant="rounded" width={120} height={48} />
        <Skeleton variant="rounded" width={120} height={48} />
        <Skeleton variant="rounded" width={48} height={48} />
      </Box>
      <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="40%" />
    </Box>
  );
}

export function CollectionsSkeleton() {
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={9}>
          <Skeleton variant="text" width={200} height={40} />
        </Grid>
        <Grid item xs={3}>
          <Skeleton variant="rounded" height={40} />
        </Grid>
      </Grid>
      <Box sx={{ mt: 2 }}>
        <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
      </Box>
    </Box>
  );
}

export function ContractFormSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={250} height={40} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={56} sx={{ mb: 3 }} />
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 3 }}>
        <Skeleton variant="text" width={180} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={8}>
            <Skeleton variant="rounded" height={56} />
          </Grid>
          <Grid item xs={4}>
            <Skeleton variant="rounded" height={56} />
          </Grid>
        </Grid>
      </Box>
      <Skeleton variant="rounded" height={1} sx={{ mb: 3 }} />
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Skeleton variant="rounded" height={56} />
        </Grid>
        <Grid item xs={4}>
          <Skeleton variant="rounded" height={56} />
        </Grid>
        <Grid item xs={4}>
          <Skeleton variant="rounded" height={56} />
        </Grid>
      </Grid>
      <Skeleton variant="rounded" height={48} sx={{ mt: 3 }} />
    </Box>
  );
}
