import { renderInTestApp } from '@backstage/test-utils';
import { RepositoryList } from './RepositoryList';

describe('RepositoryList', () => {
  it('renders the repository table', async () => {
    const { findByRole } =
      await renderInTestApp(<RepositoryList />);

    // Wait for the table to render
    const table = await findByRole('table');
    expect(table).toBeInTheDocument();
  });
});
