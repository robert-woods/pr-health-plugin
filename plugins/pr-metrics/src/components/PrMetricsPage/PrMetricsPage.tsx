import { Grid, Button } from '@material-ui/core';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
} from '@backstage/core-components';
import { RepositoryList } from '../RepositoryList';
import { PullRequestList } from '../PullRequestList';
import { Routes, Route, useNavigate } from 'react-router-dom';

const PullRequestsRoute = () => {
  const navigate = useNavigate();

  return (
    <>
      <ContentHeader title="Pull Requests">
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(-1)}
        >
          Back to Repositories
        </Button>
      </ContentHeader>

      <Grid container spacing={3} direction="column">
        <Grid item>
          <PullRequestList />
        </Grid>
      </Grid>
    </>
  );
};

export const PrMetricsPage = () => (
  <Page themeId="tool">
    <Header title="Welcome to pr-metrics!" subtitle="Optional subtitle">
      <HeaderLabel label="Owner" value="Team X" />
      <HeaderLabel label="Lifecycle" value="Alpha" />
    </Header>
    <Content>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <ContentHeader title="My Repositories">
                <SupportButton>View your GitHub repositories and their pull requests.</SupportButton>
              </ContentHeader>
              <Grid container spacing={3} direction="column">
                <Grid item>
                  <RepositoryList />
                </Grid>
              </Grid>
            </>
          }
        />
        <Route
          path="/repository/:owner/:repo"
          element={<PullRequestsRoute />}
        />
      </Routes>
    </Content>
  </Page>
);
