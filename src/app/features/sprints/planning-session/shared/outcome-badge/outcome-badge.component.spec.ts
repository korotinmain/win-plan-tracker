import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SimpleChange } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { OutcomeBadgeComponent, OUTCOME_CONFIGS } from './outcome-badge.component';
import { IssueOutcome } from '../../../../../core/models/planning-session.model';

describe('OutcomeBadgeComponent', () => {
  let fixture: ComponentFixture<OutcomeBadgeComponent>;
  let component: OutcomeBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OutcomeBadgeComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(OutcomeBadgeComponent);
    component = fixture.componentInstance;
  });

  it('renders without error', () => {
    component.outcome = 'confirmed';
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders nothing when outcome is null', () => {
    component.outcome = null;
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.ob');
    expect(badge).toBeNull();
  });

  const outcomes: IssueOutcome[] = [
    'confirmed',
    'reassigned',
    'risky-accepted',
    'needs-clarification',
    'deferred',
    'split-candidate',
  ];

  for (const outcome of outcomes) {
    it(`renders badge with correct class for "${outcome}"`, () => {
      component.outcome = outcome;
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.ob');
      expect(badge).toBeTruthy();
      expect(badge.classList).toContain(OUTCOME_CONFIGS[outcome].cssClass);
    });

    it(`renders the correct label for "${outcome}"`, () => {
      component.outcome = outcome;
      fixture.detectChanges();
      const label: HTMLElement = fixture.nativeElement.querySelector('.ob__label');
      expect(label.textContent?.trim()).toBe(OUTCOME_CONFIGS[outcome].label);
    });

    it(`renders the correct icon for "${outcome}"`, () => {
      component.outcome = outcome;
      fixture.detectChanges();
      const icon: HTMLElement = fixture.nativeElement.querySelector('mat-icon.ob__icon');
      expect(icon.textContent?.trim()).toBe(OUTCOME_CONFIGS[outcome].icon);
    });
  }
});
