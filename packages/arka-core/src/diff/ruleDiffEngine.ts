/**
 * Compliance Policy Diff Engine
 *
 * Compares rule sets and generates detailed diffs for version control
 * and audit trails (Enhancement #11).
 */

import type { ArkaRule, ArkaCondition, ArkaConsequence } from '@arka/types';

/**
 * Diff operation type
 */
export type DiffOperation = 'ADD' | 'DELETE' | 'MODIFY' | 'UNCHANGED';

/**
 * Field-level change
 */
export interface FieldChange {
  /** Field path */
  field: string;

  /** Previous value */
  oldValue: unknown;

  /** New value */
  newValue: unknown;

  /** Type of change */
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
}

/**
 * Rule diff entry
 */
export interface RuleDiff {
  /** Rule ID */
  ruleId: string;

  /** Rule name */
  ruleName: string;

  /** Diff operation */
  operation: DiffOperation;

  /** Old rule (if modified or deleted) */
  oldRule?: ArkaRule;

  /** New rule (if added or modified) */
  newRule?: ArkaRule;

  /** Field-level changes */
  fieldChanges: FieldChange[];

  /** Condition changes (structural diff) */
  conditionDiff?: ConditionDiff;

  /** Consequence changes */
  consequenceDiff?: ConsequenceDiff;

  /** Impact assessment */
  impact: DiffImpact;
}

/**
 * Condition structural diff
 */
export interface ConditionDiff {
  /** Whether condition structure changed */
  structureChanged: boolean;

  /** Fields added */
  fieldsAdded: string[];

  /** Fields removed */
  fieldsRemoved: string[];

  /** Operators changed */
  operatorsChanged: Array<{
    field: string;
    oldOperator: string;
    newOperator: string;
  }>;

  /** Values changed */
  valuesChanged: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;

  /** Human-readable summary */
  summary: string;
}

/**
 * Consequence diff
 */
export interface ConsequenceDiff {
  /** Decision changed */
  decisionChanged: boolean;

  /** Old decision */
  oldDecision?: string;

  /** New decision */
  newDecision?: string;

  /** Code changed */
  codeChanged: boolean;

  /** Message changed */
  messageChanged: boolean;

  /** Severity changed */
  severityChanged: boolean;

  /** Summary */
  summary: string;
}

/**
 * Impact assessment
 */
export interface DiffImpact {
  /** Severity of the change */
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  /** Categories affected */
  categories: string[];

  /** Potential risks */
  risks: string[];

  /** Recommended review level */
  reviewLevel: 'NONE' | 'AUTOMATED' | 'PEER' | 'SENIOR' | 'COMMITTEE';

  /** Breaking change indicator */
  breakingChange: boolean;

  /** Backward compatible */
  backwardCompatible: boolean;
}

/**
 * Full diff result between two rule sets
 */
export interface RuleSetDiff {
  /** Diff identifier */
  id: string;

  /** Timestamp */
  timestamp: string;

  /** Source rule set version/identifier */
  sourceVersion: string;

  /** Target rule set version/identifier */
  targetVersion: string;

  /** Individual rule diffs */
  diffs: RuleDiff[];

  /** Summary statistics */
  summary: {
    totalRules: {
      source: number;
      target: number;
    };
    added: number;
    deleted: number;
    modified: number;
    unchanged: number;
  };

  /** Overall impact */
  overallImpact: DiffImpact;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Rule Diff Engine
 */
export class RuleDiffEngine {
  /**
   * Compare two rule sets
   */
  compare(
    sourceRules: ArkaRule[],
    targetRules: ArkaRule[],
    sourceVersion?: string,
    targetVersion?: string
  ): RuleSetDiff {
    const sourceMap = new Map(sourceRules.map((r) => [r.id, r]));
    const targetMap = new Map(targetRules.map((r) => [r.id, r]));

    const diffs: RuleDiff[] = [];

    // Find added and modified rules
    for (const [ruleId, targetRule] of targetMap) {
      const sourceRule = sourceMap.get(ruleId);

      if (!sourceRule) {
        // Rule was added
        diffs.push(this.createAddDiff(targetRule));
      } else {
        // Check for modifications
        const diff = this.compareRules(sourceRule, targetRule);
        if (diff.operation !== 'UNCHANGED') {
          diffs.push(diff);
        } else {
          diffs.push(diff);
        }
      }
    }

    // Find deleted rules
    for (const [ruleId, sourceRule] of sourceMap) {
      if (!targetMap.has(ruleId)) {
        diffs.push(this.createDeleteDiff(sourceRule));
      }
    }

    // Sort by operation (deletes, modifies, adds) then by rule name
    diffs.sort((a, b) => {
      const opOrder: Record<DiffOperation, number> = {
        DELETE: 0,
        MODIFY: 1,
        ADD: 2,
        UNCHANGED: 3,
      };
      const opDiff = opOrder[a.operation] - opOrder[b.operation];
      if (opDiff !== 0) return opDiff;
      return a.ruleName.localeCompare(b.ruleName);
    });

    // Calculate summary
    const summary = {
      totalRules: {
        source: sourceRules.length,
        target: targetRules.length,
      },
      added: diffs.filter((d) => d.operation === 'ADD').length,
      deleted: diffs.filter((d) => d.operation === 'DELETE').length,
      modified: diffs.filter((d) => d.operation === 'MODIFY').length,
      unchanged: diffs.filter((d) => d.operation === 'UNCHANGED').length,
    };

    // Calculate overall impact
    const overallImpact = this.calculateOverallImpact(diffs);

    return {
      id: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sourceVersion: sourceVersion ?? 'source',
      targetVersion: targetVersion ?? 'target',
      diffs,
      summary,
      overallImpact,
    };
  }

  /**
   * Compare two individual rules
   */
  compareRules(sourceRule: ArkaRule, targetRule: ArkaRule): RuleDiff {
    const fieldChanges: FieldChange[] = [];

    // Compare simple fields
    const simpleFields = [
      'name',
      'description',
      'appliesToEntityType',
      'appliesToEventType',
      'jurisdiction',
      'effectiveFrom',
      'effectiveTo',
      'severity',
      'status',
    ] as const;

    for (const field of simpleFields) {
      const oldValue = sourceRule[field];
      const newValue = targetRule[field];

      if (!this.deepEquals(oldValue, newValue)) {
        fieldChanges.push({
          field,
          oldValue,
          newValue,
          changeType: oldValue === undefined ? 'ADDED' : newValue === undefined ? 'REMOVED' : 'MODIFIED',
        });
      }
    }

    // Compare tags
    if (!this.arraysEqual(sourceRule.tags, targetRule.tags)) {
      fieldChanges.push({
        field: 'tags',
        oldValue: sourceRule.tags,
        newValue: targetRule.tags,
        changeType: 'MODIFIED',
      });
    }

    // Compare metadata
    if (!this.deepEquals(sourceRule.metadata, targetRule.metadata)) {
      fieldChanges.push({
        field: 'metadata',
        oldValue: sourceRule.metadata,
        newValue: targetRule.metadata,
        changeType: 'MODIFIED',
      });
    }

    // Compare condition
    const conditionDiff = this.compareConditions(sourceRule.condition, targetRule.condition);

    // Compare consequence
    const consequenceDiff = this.compareConsequences(sourceRule.consequence, targetRule.consequence);

    // Determine operation
    const operation: DiffOperation =
      fieldChanges.length > 0 ||
      conditionDiff.structureChanged ||
      consequenceDiff.decisionChanged ||
      consequenceDiff.codeChanged
        ? 'MODIFY'
        : 'UNCHANGED';

    // Calculate impact
    const impact = this.calculateRuleImpact(fieldChanges, conditionDiff, consequenceDiff);

    return {
      ruleId: sourceRule.id,
      ruleName: sourceRule.name,
      operation,
      oldRule: sourceRule,
      newRule: targetRule,
      fieldChanges,
      conditionDiff: conditionDiff.structureChanged ? conditionDiff : undefined,
      consequenceDiff: consequenceDiff.decisionChanged || consequenceDiff.codeChanged ? consequenceDiff : undefined,
      impact,
    };
  }

  /**
   * Compare conditions
   */
  private compareConditions(source: ArkaCondition, target: ArkaCondition): ConditionDiff {
    const sourceFields = this.extractConditionFields(source);
    const targetFields = this.extractConditionFields(target);

    const fieldsAdded = targetFields.filter((f) => !sourceFields.some((sf) => sf.field === f.field));
    const fieldsRemoved = sourceFields.filter((f) => !targetFields.some((tf) => tf.field === f.field));

    const operatorsChanged: ConditionDiff['operatorsChanged'] = [];
    const valuesChanged: ConditionDiff['valuesChanged'] = [];

    for (const sourceField of sourceFields) {
      const targetField = targetFields.find((f) => f.field === sourceField.field);
      if (targetField) {
        if (sourceField.operator !== targetField.operator) {
          operatorsChanged.push({
            field: sourceField.field,
            oldOperator: sourceField.operator,
            newOperator: targetField.operator,
          });
        }
        if (!this.deepEquals(sourceField.value, targetField.value)) {
          valuesChanged.push({
            field: sourceField.field,
            oldValue: sourceField.value,
            newValue: targetField.value,
          });
        }
      }
    }

    const structureChanged =
      fieldsAdded.length > 0 ||
      fieldsRemoved.length > 0 ||
      operatorsChanged.length > 0 ||
      valuesChanged.length > 0 ||
      source.type !== target.type;

    const summaryParts: string[] = [];
    if (fieldsAdded.length > 0) {
      summaryParts.push(`Added fields: ${fieldsAdded.map((f) => f.field).join(', ')}`);
    }
    if (fieldsRemoved.length > 0) {
      summaryParts.push(`Removed fields: ${fieldsRemoved.map((f) => f.field).join(', ')}`);
    }
    if (operatorsChanged.length > 0) {
      summaryParts.push(`Changed operators: ${operatorsChanged.map((o) => o.field).join(', ')}`);
    }
    if (valuesChanged.length > 0) {
      summaryParts.push(`Changed values: ${valuesChanged.map((v) => v.field).join(', ')}`);
    }

    return {
      structureChanged,
      fieldsAdded: fieldsAdded.map((f) => f.field),
      fieldsRemoved: fieldsRemoved.map((f) => f.field),
      operatorsChanged,
      valuesChanged,
      summary: summaryParts.length > 0 ? summaryParts.join('; ') : 'No structural changes',
    };
  }

  /**
   * Extract fields from condition tree
   */
  private extractConditionFields(
    condition: ArkaCondition
  ): Array<{ field: string; operator: string; value: unknown }> {
    const fields: Array<{ field: string; operator: string; value: unknown }> = [];

    const extract = (cond: ArkaCondition): void => {
      switch (cond.type) {
        case 'compare':
          fields.push({
            field: cond.field,
            operator: cond.operator,
            value: cond.value,
          });
          break;
        case 'and':
        case 'or':
          for (const child of cond.conditions) {
            extract(child);
          }
          break;
        case 'not':
          extract(cond.condition);
          break;
      }
    };

    extract(condition);
    return fields;
  }

  /**
   * Compare consequences
   */
  private compareConsequences(source: ArkaConsequence, target: ArkaConsequence): ConsequenceDiff {
    const decisionChanged = source.decision !== target.decision;
    const codeChanged = source.code !== target.code;
    const messageChanged = source.message !== target.message;
    const severityChanged = false; // Severity is on rule, not consequence

    const summaryParts: string[] = [];
    if (decisionChanged) {
      summaryParts.push(`Decision: ${source.decision} -> ${target.decision}`);
    }
    if (codeChanged) {
      summaryParts.push(`Code: ${source.code} -> ${target.code}`);
    }
    if (messageChanged) {
      summaryParts.push('Message changed');
    }

    return {
      decisionChanged,
      oldDecision: decisionChanged ? source.decision : undefined,
      newDecision: decisionChanged ? target.decision : undefined,
      codeChanged,
      messageChanged,
      severityChanged,
      summary: summaryParts.length > 0 ? summaryParts.join('; ') : 'No consequence changes',
    };
  }

  /**
   * Create diff for added rule
   */
  private createAddDiff(rule: ArkaRule): RuleDiff {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      operation: 'ADD',
      newRule: rule,
      fieldChanges: [],
      impact: {
        severity: this.severityFromRuleSeverity(rule.severity),
        categories: ['new-rule'],
        risks: ['New rule may affect existing workflows'],
        reviewLevel: rule.severity === 'CRITICAL' ? 'COMMITTEE' : 'PEER',
        breakingChange: false,
        backwardCompatible: true,
      },
    };
  }

  /**
   * Create diff for deleted rule
   */
  private createDeleteDiff(rule: ArkaRule): RuleDiff {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      operation: 'DELETE',
      oldRule: rule,
      fieldChanges: [],
      impact: {
        severity: this.severityFromRuleSeverity(rule.severity),
        categories: ['rule-deletion'],
        risks: ['Removed compliance check', 'May allow previously blocked actions'],
        reviewLevel: rule.severity === 'CRITICAL' ? 'COMMITTEE' : 'SENIOR',
        breakingChange: true,
        backwardCompatible: false,
      },
    };
  }

  /**
   * Calculate impact for a rule change
   */
  private calculateRuleImpact(
    fieldChanges: FieldChange[],
    conditionDiff: ConditionDiff,
    consequenceDiff: ConsequenceDiff
  ): DiffImpact {
    const categories: string[] = [];
    const risks: string[] = [];
    let severity: DiffImpact['severity'] = 'LOW';
    let reviewLevel: DiffImpact['reviewLevel'] = 'AUTOMATED';
    let breakingChange = false;
    let backwardCompatible = true;

    // Decision change is high impact
    if (consequenceDiff.decisionChanged) {
      categories.push('decision-change');
      risks.push('Decision behavior will change');
      severity = 'HIGH';
      reviewLevel = 'SENIOR';
      breakingChange = true;
      backwardCompatible = false;
    }

    // Severity change
    const severityChange = fieldChanges.find((f) => f.field === 'severity');
    if (severityChange) {
      categories.push('severity-change');
      const newSeverity = severityChange.newValue as string;
      if (newSeverity === 'CRITICAL' || newSeverity === 'HIGH') {
        severity = 'HIGH';
        reviewLevel = 'SENIOR';
      }
    }

    // Condition changes
    if (conditionDiff.structureChanged) {
      categories.push('condition-change');

      if (conditionDiff.fieldsRemoved.length > 0) {
        risks.push('Rule may match more events (fields removed)');
        severity = severity === 'LOW' ? 'MEDIUM' : severity;
      }

      if (conditionDiff.fieldsAdded.length > 0) {
        risks.push('Rule may match fewer events (fields added)');
        severity = severity === 'LOW' ? 'MEDIUM' : severity;
      }

      if (conditionDiff.operatorsChanged.length > 0) {
        risks.push('Comparison logic changed');
        severity = severity === 'LOW' ? 'MEDIUM' : severity;
      }

      reviewLevel = reviewLevel === 'AUTOMATED' ? 'PEER' : reviewLevel;
    }

    // Effective date changes
    const dateChange = fieldChanges.find(
      (f) => f.field === 'effectiveFrom' || f.field === 'effectiveTo'
    );
    if (dateChange) {
      categories.push('temporal-change');
      risks.push('Rule applicability period changed');
    }

    // Jurisdiction change
    const jurisdictionChange = fieldChanges.find((f) => f.field === 'jurisdiction');
    if (jurisdictionChange) {
      categories.push('jurisdiction-change');
      risks.push('Rule scope changed');
      reviewLevel = 'SENIOR';
    }

    if (categories.length === 0) {
      categories.push('minor-change');
      severity = 'NONE';
    }

    return {
      severity,
      categories,
      risks,
      reviewLevel,
      breakingChange,
      backwardCompatible,
    };
  }

  /**
   * Calculate overall impact from all diffs
   */
  private calculateOverallImpact(diffs: RuleDiff[]): DiffImpact {
    const allCategories = new Set<string>();
    const allRisks = new Set<string>();
    let highestSeverity: DiffImpact['severity'] = 'NONE';
    let highestReviewLevel: DiffImpact['reviewLevel'] = 'NONE';
    let hasBreakingChange = false;
    let allBackwardCompatible = true;

    const severityOrder: Record<DiffImpact['severity'], number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const reviewOrder: Record<DiffImpact['reviewLevel'], number> = {
      NONE: 0,
      AUTOMATED: 1,
      PEER: 2,
      SENIOR: 3,
      COMMITTEE: 4,
    };

    for (const diff of diffs) {
      if (diff.operation === 'UNCHANGED') continue;

      for (const cat of diff.impact.categories) {
        allCategories.add(cat);
      }
      for (const risk of diff.impact.risks) {
        allRisks.add(risk);
      }

      if (severityOrder[diff.impact.severity] > severityOrder[highestSeverity]) {
        highestSeverity = diff.impact.severity;
      }

      if (reviewOrder[diff.impact.reviewLevel] > reviewOrder[highestReviewLevel]) {
        highestReviewLevel = diff.impact.reviewLevel;
      }

      if (diff.impact.breakingChange) {
        hasBreakingChange = true;
      }

      if (!diff.impact.backwardCompatible) {
        allBackwardCompatible = false;
      }
    }

    return {
      severity: highestSeverity,
      categories: Array.from(allCategories),
      risks: Array.from(allRisks),
      reviewLevel: highestReviewLevel,
      breakingChange: hasBreakingChange,
      backwardCompatible: allBackwardCompatible,
    };
  }

  private severityFromRuleSeverity(ruleSeverity: string): DiffImpact['severity'] {
    switch (ruleSeverity) {
      case 'CRITICAL':
        return 'CRITICAL';
      case 'HIGH':
        return 'HIGH';
      case 'MEDIUM':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  private deepEquals(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, i) => this.deepEquals(val, sortedB[i]));
  }
}

/**
 * Create a rule diff engine
 */
export function createRuleDiffEngine(): RuleDiffEngine {
  return new RuleDiffEngine();
}

/**
 * Generate human-readable diff report
 */
export function formatDiffReport(diff: RuleSetDiff): string {
  const lines: string[] = [];

  lines.push('# Rule Set Diff Report');
  lines.push(`Generated: ${diff.timestamp}`);
  lines.push(`Source: ${diff.sourceVersion}`);
  lines.push(`Target: ${diff.targetVersion}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`- Total rules in source: ${diff.summary.totalRules.source}`);
  lines.push(`- Total rules in target: ${diff.summary.totalRules.target}`);
  lines.push(`- Added: ${diff.summary.added}`);
  lines.push(`- Deleted: ${diff.summary.deleted}`);
  lines.push(`- Modified: ${diff.summary.modified}`);
  lines.push(`- Unchanged: ${diff.summary.unchanged}`);
  lines.push('');

  lines.push('## Impact Assessment');
  lines.push(`- Severity: ${diff.overallImpact.severity}`);
  lines.push(`- Review Level: ${diff.overallImpact.reviewLevel}`);
  lines.push(`- Breaking Change: ${diff.overallImpact.breakingChange ? 'Yes' : 'No'}`);
  lines.push(`- Backward Compatible: ${diff.overallImpact.backwardCompatible ? 'Yes' : 'No'}`);
  lines.push('');

  if (diff.overallImpact.risks.length > 0) {
    lines.push('### Risks');
    for (const risk of diff.overallImpact.risks) {
      lines.push(`- ${risk}`);
    }
    lines.push('');
  }

  lines.push('## Changes');
  lines.push('');

  for (const ruleDiff of diff.diffs) {
    if (ruleDiff.operation === 'UNCHANGED') continue;

    lines.push(`### ${ruleDiff.operation}: ${ruleDiff.ruleName} (${ruleDiff.ruleId})`);

    if (ruleDiff.fieldChanges.length > 0) {
      lines.push('**Field Changes:**');
      for (const change of ruleDiff.fieldChanges) {
        lines.push(`- ${change.field}: \`${JSON.stringify(change.oldValue)}\` -> \`${JSON.stringify(change.newValue)}\``);
      }
    }

    if (ruleDiff.conditionDiff) {
      lines.push(`**Condition:** ${ruleDiff.conditionDiff.summary}`);
    }

    if (ruleDiff.consequenceDiff) {
      lines.push(`**Consequence:** ${ruleDiff.consequenceDiff.summary}`);
    }

    lines.push(`**Impact:** ${ruleDiff.impact.severity} | Review: ${ruleDiff.impact.reviewLevel}`);
    lines.push('');
  }

  return lines.join('\n');
}
