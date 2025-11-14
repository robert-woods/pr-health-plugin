import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
  Link,
} from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import { Octokit } from "octokit";
import { useRouteRef } from '@backstage/core-plugin-api';
import { repositoryPullRequestsRouteRef } from '../../routes';

const octokit = new Octokit({ auth: `` });

type Repository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  visibility: string;
  owner: {
    login: string;
  };
};

type DenseTableProps = {
  repos: Repository[];
};

export const DenseTable = ({ repos }: DenseTableProps) => {
  const prRouteRef = useRouteRef(repositoryPullRequestsRouteRef);
  
  const columns: TableColumn[] = [
    { title: 'Name', field: 'name' },
    { title: 'Description', field: 'description' },
    { title: 'Language', field: 'language' },
    { title: 'Stars', field: 'stars' },
    { title: 'Visibility', field: 'visibility' },
  ];

  const data = repos.map(repo => {
    const [owner, repoName] = repo.full_name.split('/');
    
    return {
      name: (
        <Link to={prRouteRef({ owner, repo: repoName })}>
          {repo.name}
        </Link>
      ),
      description: repo.description || 'No description',
      language: repo.language || 'N/A',
      stars: repo.stargazers_count,
      visibility: repo.visibility,
    };
  });

  return (
    <Table
      title="My GitHub Repositories"
      options={{ search: true, paging: true, pageSize: 10 }}
      columns={columns}
      data={data}
    />
  );
};

export const RepositoryList = () => {
  const { value, loading, error } = useAsync(async (): Promise<Repository[]> => {
    const response = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });
    return response.data as Repository[];
  }, []);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return <DenseTable repos={value || []} />;
};
