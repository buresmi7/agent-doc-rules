export function activityStatus(activity) {
  if (activity.exitCode !== null && activity.exitCode !== undefined) {
    return activity.exitCode === 0 ? 'completed' : 'failed';
  }

  return activity.status;
}

export function overviewSubtitle(report) {
  if (report.status === 'passed') {
    return 'The scenario met its pass threshold and all expectations.';
  }

  if (report.status === 'failed') {
    if (report.evaluation?.outcomeReason === 'score-below-threshold') {
      return 'The judge accepted the result, but its score was below the scenario pass threshold.';
    }

    if (report.evaluation?.failedCriteria?.length > 0) {
      return 'The run completed, but one or more expectations did not pass.';
    }

    return 'The run completed, but the judge did not accept the result.';
  }

  if (report.status === 'error') {
    return `The scenario stopped during the ${report.stage} stage.`;
  }

  return `Latest checkpoint from the ${report.stage} stage.`;
}
