import { renderInTestApp } from '@backstage/test-utils';
import { PullRequestList } from './PullRequestList';
import { Route, Routes } from 'react-router-dom';

describe('PullRequestList', () => {
  it('renders the pull request table', async () => {
    const { findByRole } = await renderInTestApp(
      <Routes>
        <Route path="/repository/:owner/:repo" element={<PullRequestList />} />
      </Routes>,
      {
        routeEntries: ['/repository/test-owner/test-repo'],
      }
    );

    // Wait for the table to render
    const table = await findByRole('table');
    expect(table).toBeInTheDocument();
  });
});
