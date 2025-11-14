import {
    Progress,
    ResponseErrorPanel,
    StatusOK,
    StatusError,
    StatusWarning,
    StatusPending,
    InfoCard,
} from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import { Octokit } from "octokit";
import { useParams } from 'react-router-dom';
import { Grid, Box, Typography, Chip, Divider, makeStyles, Button, TextField, MenuItem, Select, FormControl, InputLabel, TablePagination, Collapse } from '@material-ui/core';
import { useEffect, useState } from 'react';
import SearchIcon from '@material-ui/icons/Search';

const useStyles = makeStyles((theme) => ({
    prCard: {
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[8],
        },
    },
    prTitle: {
        fontWeight: 600,
        marginBottom: theme.spacing(0.5),
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '0.8rem',
        lineHeight: 1.3,
        '& a': {
            color: theme.palette.text.primary,
            textDecoration: 'none',
            '&:hover': {
                textDecoration: 'underline',
            },
        },
    },
    prNumber: {
        '& a': {
            color: theme.palette.primary.main,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            '&:hover': {
                textDecoration: 'underline',
            },
        },
    },
    authorBox: {
        display: 'flex',
        flexDirection: 'row',
        gap: theme.spacing(0.5),
        marginBottom: theme.spacing(0.5),
    },
    checkSection: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing(0.5),
        backgroundColor: theme.palette.background.default,
        borderRadius: theme.shape.borderRadius,
        marginBottom: theme.spacing(0.5),
    },
    dateSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(0.5),
    },
    draftChip: {
        backgroundColor: theme.palette.warning.light,
        color: theme.palette.warning.contrastText,
    },
    metricsCard: {
        padding: theme.spacing(2),
        textAlign: 'center',
        height: '100%',
        background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.primary.main}05 100%)`,
        borderLeft: `4px solid ${theme.palette.primary.main}`,
    },
    metricValue: {
        fontSize: '2rem',
        fontWeight: 700,
        color: theme.palette.primary.main,
        marginBottom: theme.spacing(0.5),
    },
    metricLabel: {
        fontSize: '0.875rem',
        color: theme.palette.text.secondary,
        fontWeight: 500,
    },
    failureMetric: {
        borderLeft: `4px solid ${theme.palette.error.main}`,
        background: `linear-gradient(135deg, ${theme.palette.error.main}15 0%, ${theme.palette.error.main}05 100%)`,
        '& $metricValue': {
            color: theme.palette.error.main,
        },
    },
    successMetric: {
        borderLeft: `4px solid ${theme.palette.success.main}`,
        background: `linear-gradient(135deg, ${theme.palette.success.main}15 0%, ${theme.palette.success.main}05 100%)`,
        '& $metricValue': {
            color: theme.palette.success.main,
        },
    },
    warningMetric: {
        borderLeft: `4px solid ${theme.palette.warning.main}`,
        background: `linear-gradient(135deg, ${theme.palette.warning.main}15 0%, ${theme.palette.warning.main}05 100%)`,
        '& $metricValue': {
            color: theme.palette.warning.main,
        },
    },
    filterBar: {
        marginBottom: theme.spacing(3),
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
    },
    searchInput: {
        minWidth: 200,
    },
}));

const octokit = new Octokit({ auth: `` });

type PullRequest = {
    id: number;
    number: number;
    title: string;
    html_url: string;
    state: string;
    created_at: string;
    updated_at: string;
    head: {
        sha: string;
    };
    base: {
        ref: string;
    };
    user: {
        login: string;
        avatar_url: string;
    };
    draft: boolean;
    labels: Array<{
        name: string;
        color: string;
    }>;
};

type CheckStatus = {
    state: 'success' | 'failure' | 'pending' | 'error' | 'neutral' | null;
    total_count: number;
};

type PullRequestWithChecks = PullRequest & {
    checkStatus?: CheckStatus;
};

type PullRequestTableProps = {
    pullRequests: PullRequestWithChecks[];
    owner: string;
    repo: string;
    secondsUntilRefresh: number;
    onRefreshNow: () => void;
};

const CheckStatusIcon = ({ status }: { status?: CheckStatus }) => {
    if (!status) {
        return <span>-</span>;
    }

    if (status.total_count === 0) {
        return <span>No checks</span>;
    }

    switch (status.state) {
        case 'success':
            return <StatusOK>Passed</StatusOK>;
        case 'failure':
        case 'error':
            return <StatusError>Failed</StatusError>;
        case 'pending':
            return <StatusPending>Running</StatusPending>;
        case 'neutral':
            return <StatusWarning>Neutral</StatusWarning>;
        default:
            return <StatusPending>Checking...</StatusPending>;
    }
};

export const PullRequestTable = ({ pullRequests, owner, repo, secondsUntilRefresh, onRefreshNow }: PullRequestTableProps) => {
    const classes = useStyles();
    
    // Collapse state
    const [isGridExpanded, setIsGridExpanded] = useState(true);
    
    // Pagination state
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    
    // Filter and sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'passing' | 'failing' | 'pending' | 'no-checks'>('all');
    const [draftFilter, setDraftFilter] = useState<'all' | 'draft' | 'ready'>('all');
    const [sortBy, setSortBy] = useState<'number' | 'age' | 'updated' | 'status'>('number');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Calculate metrics
    const now = new Date();
    const totalPRs = pullRequests.length;
    const prsWithChecks = pullRequests.filter(pr => pr.checkStatus && pr.checkStatus.total_count > 0);
    const failingPRs = pullRequests.filter(pr => pr.checkStatus?.state === 'failure' || pr.checkStatus?.state === 'error');
    const passingPRs = pullRequests.filter(pr => pr.checkStatus?.state === 'success');

    const failureRate = prsWithChecks.length > 0 ? Math.round((failingPRs.length / prsWithChecks.length) * 100) : 0;
    const successRate = prsWithChecks.length > 0 ? Math.round((passingPRs.length / prsWithChecks.length) * 100) : 0;

    // Calculate average age
    const avgAge = totalPRs > 0
        ? Math.round(pullRequests.reduce((sum, pr) => {
            const created = new Date(pr.created_at);
            return sum + (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / totalPRs)
        : 0;

    // New metrics
    const stalePRs = pullRequests.filter(pr => {
        const updated = new Date(pr.updated_at);
        const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate >= 7;
    }).length;

    const draftPRs = pullRequests.filter(pr => pr.draft).length;

    const oldestPRAge = totalPRs > 0
        ? Math.max(...pullRequests.map(pr => {
            const created = new Date(pr.created_at);
            return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }))
        : 0;

    const prsUpdatedToday = pullRequests.filter(pr => {
        const updated = new Date(pr.updated_at);
        const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate < 1;
    }).length;

    // Filter PRs
    const filteredPRs = pullRequests.filter(pr => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesNumber = pr.number.toString().includes(query);
            const matchesTitle = pr.title.toLowerCase().includes(query);
            const matchesAuthor = pr.user.login.toLowerCase().includes(query);
            if (!matchesNumber && !matchesTitle && !matchesAuthor) {
                return false;
            }
        }

        // Status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'passing' && pr.checkStatus?.state !== 'success') return false;
            if (statusFilter === 'failing' && pr.checkStatus?.state !== 'failure' && pr.checkStatus?.state !== 'error') return false;
            if (statusFilter === 'pending' && pr.checkStatus?.state !== 'pending') return false;
            if (statusFilter === 'no-checks' && (pr.checkStatus?.total_count ?? 0) > 0) return false;
        }

        // Draft filter
        if (draftFilter !== 'all') {
            if (draftFilter === 'draft' && !pr.draft) return false;
            if (draftFilter === 'ready' && pr.draft) return false;
        }

        return true;
    });

    // Sort PRs
    const sortedPRs = [...filteredPRs].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'number':
                comparison = a.number - b.number;
                break;
            case 'age':
                comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                break;
            case 'updated':
                comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                break;
            case 'status': {
                const statusOrder: Record<string, number> = { success: 0, pending: 1, failure: 2, error: 2, neutral: 3, null: 4 };
                const aStatus = a.checkStatus?.state ?? 'null';
                const bStatus = b.checkStatus?.state ?? 'null';
                comparison = statusOrder[aStatus] - statusOrder[bStatus];
                break;
            }
            default:
                comparison = 0;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate PRs
    const paginatedPRs = sortedPRs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Box>
            <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                    <Typography variant="h4" style={{ fontWeight: 700, marginBottom: 4 }}>
                        PR Metrics: {owner}/{repo}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Real-time pull request monitoring and analytics
                    </Typography>
                </Box>
                <Box display="flex" alignItems="center" style={{ gap: '16px' }}>
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                        <Typography variant="caption" color="textSecondary">
                            Auto-refresh in
                        </Typography>
                        <Typography variant="h6" style={{ fontWeight: 600, fontFamily: 'monospace', lineHeight: 1 }}>
                            {formatTime(secondsUntilRefresh)}
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onRefreshNow}
                        size="small"
                    >
                        Refresh Now
                    </Button>
                </Box>
            </Box>

            {/* Metrics Dashboard */}
            <Grid container spacing={2} style={{ marginBottom: 24 }}>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={classes.metricsCard} title="Open Pull Requests">
                        <Typography className={classes.metricValue}>{totalPRs}</Typography>
                        <Typography className={classes.metricLabel}>Currently Open</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={`${classes.metricsCard} ${classes.failureMetric}`} title="Failing Checks">
                        <Typography className={classes.metricValue}>{failureRate}%</Typography>
                        <Typography className={classes.metricLabel}>PRs with Failed Checks</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={`${classes.metricsCard} ${classes.successMetric}`} title="Passing Checks">
                        <Typography className={classes.metricValue}>{successRate}%</Typography>
                        <Typography className={classes.metricLabel}>PRs Passing All Checks</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={`${classes.metricsCard} ${classes.warningMetric}`} title="Average Age">
                        <Typography className={classes.metricValue}>{avgAge}</Typography>
                        <Typography className={classes.metricLabel}>Days Since Created</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={`${classes.metricsCard} ${classes.warningMetric}`} title="Stale Pull Requests">
                        <Typography className={classes.metricValue}>{stalePRs}</Typography>
                        <Typography className={classes.metricLabel}>No Updates in 7+ Days</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={classes.metricsCard} title="Draft Pull Requests">
                        <Typography className={classes.metricValue}>{draftPRs}</Typography>
                        <Typography className={classes.metricLabel}>Work in Progress</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={`${classes.metricsCard} ${classes.warningMetric}`} title="Oldest Pull Request">
                        <Typography className={classes.metricValue}>{oldestPRAge}</Typography>
                        <Typography className={classes.metricLabel}>Days Since Opened</Typography>
                    </InfoCard>
                </Grid>
                <Grid item xs={isGridExpanded ? 6 : 12} sm={isGridExpanded ? 4 : 6} md={isGridExpanded ? 3 : 4} lg={isGridExpanded ? 3 : 3}>
                    <InfoCard className={`${classes.metricsCard} ${classes.successMetric}`} title="Recent Activity">
                        <Typography className={classes.metricValue}>{prsUpdatedToday}</Typography>
                        <Typography className={classes.metricLabel}>Updated in Last 24hrs</Typography>
                    </InfoCard>
                </Grid>
            </Grid>

            {/* PR Details Section Header */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h5" style={{ fontWeight: 600 }}>
                    All Pull Requests
                </Typography>
                <Button
                    onClick={() => setIsGridExpanded(!isGridExpanded)}
                    variant="outlined"
                    size="small"
                >
                    {isGridExpanded ? 'Hide Details' : 'Show Details'}
                </Button>
            </Box>

            {/* Collapsible PR Grid Section */}
            <Collapse in={isGridExpanded}>
                {/* Filters and Controls */}
                <Box className={classes.filterBar}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            className={classes.searchInput}
                            fullWidth
                            size="small"
                            variant="outlined"
                            placeholder="Search by title, number, or author..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: <SearchIcon style={{ marginRight: 8, color: 'rgba(0,0,0,0.54)' }} />,
                            }}
                        />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Check Status</InputLabel>
                            <Select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                label="Check Status"
                            >
                                <MenuItem value="all">All Statuses</MenuItem>
                                <MenuItem value="passing">✓ Passing</MenuItem>
                                <MenuItem value="failing">✗ Failing</MenuItem>
                                <MenuItem value="pending">⟳ Pending</MenuItem>
                                <MenuItem value="no-checks">− No Checks</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>PR Type</InputLabel>
                            <Select
                                value={draftFilter}
                                onChange={(e) => setDraftFilter(e.target.value as any)}
                                label="PR Type"
                            >
                                <MenuItem value="all">All Types</MenuItem>
                                <MenuItem value="draft">Draft PRs</MenuItem>
                                <MenuItem value="ready">Ready for Review</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                label="Sort By"
                            >
                                <MenuItem value="number">PR Number</MenuItem>
                                <MenuItem value="age">Age (Created)</MenuItem>
                                <MenuItem value="updated">Last Updated</MenuItem>
                                <MenuItem value="status">Check Status</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={2} md={1}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Order</InputLabel>
                            <Select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as any)}
                                label="Order"
                            >
                                <MenuItem value="asc">Ascending</MenuItem>
                                <MenuItem value="desc">Descending</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <Typography variant="body2" color="textSecondary">
                            Showing {paginatedPRs.length} of {sortedPRs.length} PRs
                        </Typography>
                    </Grid>
                </Grid>
            </Box>

            {/* PR Grid */}
            <Grid container spacing={2}>
                {paginatedPRs.map(pr => {
                    const updatedDate = new Date(pr.updated_at);
                    const daysSinceUpdate = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));

                    let updateText = `${daysSinceUpdate} days ago`;
                    if (daysSinceUpdate === 0) {
                        updateText = 'today';
                    } else if (daysSinceUpdate === 1) {
                        updateText = 'yesterday';
                    }

                    return (
                        <Grid item xs={6} sm={4} md={3} lg={3} xl={2} key={pr.id}>
                            <InfoCard
                                title={
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle2" className={classes.prNumber}>
                                            <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                                                #{pr.number}
                                            </a>
                                        </Typography>
                                        {pr.draft && <Chip label="Draft" size="small" style={{ height: 18, fontSize: '0.65rem' }} className={classes.draftChip} />}
                                    </Box>
                                }
                                className={classes.prCard}
                            >
                                <Box display="flex" flexDirection="column">
                                    <Box display="flex" gridGap="2">
                                        <Typography variant="body2" className={classes.prTitle}>
                                            <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                                                {pr.title}
                                            </a>
                                        </Typography>
                                        <span>-</span>
                                        <Typography variant="caption" style={{ fontWeight: 500, fontSize: '0.7rem' }}>
                                            {pr.user.login}
                                        </Typography>
                                    </Box>

                                    <Divider style={{ marginBottom: 4 }} />

                                    <Box className={classes.checkSection}>
                                        <Typography variant="caption" style={{ fontWeight: 600, fontSize: '0.7rem' }}>
                                            CI/CD Status
                                        </Typography>
                                        <CheckStatusIcon status={pr.checkStatus} />
                                    </Box>

                                    <Box className={classes.dateSection}>
                                        <Typography variant="caption" color="textSecondary" style={{ fontSize: '0.65rem' }}>
                                            Last updated {updateText}
                                        </Typography>
                                    </Box>
                                </Box>
                            </InfoCard>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Pagination */}
            {sortedPRs.length > 0 && (
                <Box display="flex" justifyContent="center" mt={3}>
                    <TablePagination
                        component="div"
                        count={sortedPRs.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[25, 50, 100, 200]}
                        labelRowsPerPage="PRs per page:"
                    />
                </Box>
            )}
            </Collapse>
        </Box>
    );
};

export const PullRequestList = () => {
    const { owner, repo } = useParams<{ owner: string; repo: string }>();
    const [refreshKey, setRefreshKey] = useState(0);
    const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(300); // 5 minutes = 300 seconds

    // Set up polling every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            setRefreshKey(prev => prev + 1);
            setSecondsUntilRefresh(300); // Reset countdown
        }, 5 * 60 * 1000); // 5 minutes in milliseconds

        return () => clearInterval(interval);
    }, []);

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsUntilRefresh(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleRefreshNow = () => {
        setRefreshKey(prev => prev + 1);
        setSecondsUntilRefresh(300); // Reset countdown
    };

    const { value, loading, error } = useAsync(async (): Promise<PullRequestWithChecks[]> => {
        if (!owner || !repo) {
            return [];
        }

        const response = await octokit.rest.pulls.list({
            owner,
            repo,
            state: 'open',
            per_page: 100,
        });

        const prs = response.data as PullRequest[];

        // Batch fetch check status for PRs (10 at a time for better performance)
        const batchSize = 10;
        const prsWithChecks: PullRequestWithChecks[] = [];
        
        for (let i = 0; i < prs.length; i += batchSize) {
            const batch = prs.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (pr) => {
                    try {
                        // Get the base branch (usually main/master) to fetch required checks
                        const baseBranch = pr.base.ref;

                        // Try to get repository rulesets to identify required checks
                        let requiredChecks: string[] = [];
                        try {
                            // Fetch rulesets for the repository
                            const rulesetsResponse = await octokit.rest.repos.getRepoRulesets({
                                owner,
                                repo,
                                includes_parents: true,
                            });

                            // Find rulesets that apply to the base branch
                            for (const ruleset of rulesetsResponse.data) {
                                if (ruleset.conditions?.ref_name) {
                                    const refName = ruleset.conditions.ref_name;
                                    // Check if this ruleset applies to our base branch
                                    if (refName.include?.some((pattern: string) =>
                                        pattern === baseBranch ||
                                        pattern === `refs/heads/${baseBranch}` ||
                                        (pattern.includes('*') && new RegExp(pattern.replace('*', '.*')).test(baseBranch))
                                    )) {
                                        // Extract required status checks from the ruleset
                                        const statusCheckRule = ruleset.rules?.find((rule: any) =>
                                            rule.type === 'required_status_checks'
                                        );

                                        if (statusCheckRule?.parameters?.required_status_checks) {
                                            const checks = statusCheckRule.parameters.required_status_checks.map(
                                                (check: any) => check.context
                                            );
                                            requiredChecks.push(...checks);
                                        }
                                    }
                                }
                            }
                        } catch (e: any) {
                            // Rulesets might not be available or we might not have access
                            // Fall back to showing all checks
                            requiredChecks = [];
                        }

                        const checksResponse = await octokit.rest.checks.listForRef({
                            owner,
                            repo,
                            ref: pr.head.sha,
                        });

                        const allCheckRuns = checksResponse.data.check_runs;

                        // Filter to only required checks if we have that information
                        const checkRuns = requiredChecks.length > 0
                            ? allCheckRuns.filter((run: any) => requiredChecks.includes(run.name))
                            : allCheckRuns;

                        const total_count = checkRuns.length;

                        let state: CheckStatus['state'] = null;

                        if (total_count > 0) {
                            const hasFailure = checkRuns.some((run: any) => run.conclusion === 'failure');
                            const hasError = checkRuns.some((run: any) => run.conclusion === 'action_required' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out');
                            const hasPending = checkRuns.some((run: any) => run.status !== 'completed');
                            const allSuccess = checkRuns.every((run: any) => run.conclusion === 'success');

                            if (hasPending) {
                                state = 'pending';
                            } else if (hasFailure || hasError) {
                                state = 'failure';
                            } else if (allSuccess) {
                                state = 'success';
                            } else {
                                state = 'neutral';
                            }
                        }

                        return {
                            ...pr,
                            checkStatus: { state, total_count },
                        };
                    } catch (e) {
                        // If we can't fetch checks, just return the PR without check status
                        return { ...pr, checkStatus: undefined };
                    }
                })
            );
            prsWithChecks.push(...batchResults);
        }

        return prsWithChecks;
    }, [owner, repo, refreshKey]);

    if (loading) {
        return <Progress />;
    } else if (error) {
        return <ResponseErrorPanel error={error} />;
    }

    if (!owner || !repo) {
        return <ResponseErrorPanel error={new Error('Repository owner and name are required')} />;
    }

    return (
        <PullRequestTable 
            pullRequests={value || []} 
            owner={owner} 
            repo={repo}
            secondsUntilRefresh={secondsUntilRefresh}
            onRefreshNow={handleRefreshNow}
        />
    );
};
