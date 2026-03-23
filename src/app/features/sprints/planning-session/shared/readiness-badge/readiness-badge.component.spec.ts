import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReadinessBadgeComponent } from './readiness-badge.component';

describe('ReadinessBadgeComponent', () => {
  let fixture: ComponentFixture<ReadinessBadgeComponent>;
  let component: ReadinessBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadinessBadgeComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadinessBadgeComponent);
    component = fixture.componentInstance;
  });

  it('renders without error', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('applies rb--critical class when severity is critical', () => {
    component.severity = 'critical';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('.rb');
    expect(el.classList).toContain('rb--critical');
    expect(el.classList).not.toContain('rb--warning');
    expect(el.classList).not.toContain('rb--info');
  });

  it('applies rb--warning class when severity is warning', () => {
    component.severity = 'warning';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('.rb');
    expect(el.classList).toContain('rb--warning');
    expect(el.classList).not.toContain('rb--critical');
    expect(el.classList).not.toContain('rb--info');
  });

  it('applies rb--info class when severity is info', () => {
    component.severity = 'info';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('.rb');
    expect(el.classList).toContain('rb--info');
    expect(el.classList).not.toContain('rb--critical');
    expect(el.classList).not.toContain('rb--warning');
  });

  it('renders the label text', () => {
    component.label = 'Missing estimates';
    fixture.detectChanges();
    const el: HTMLElement =
      fixture.nativeElement.querySelector('.rb__label');
    expect(el.textContent?.trim()).toBe('Missing estimates');
  });

  it('renders the icon name', () => {
    component.icon = 'data_usage';
    fixture.detectChanges();
    const el: HTMLElement =
      fixture.nativeElement.querySelector('mat-icon.rb__icon');
    expect(el.textContent?.trim()).toBe('data_usage');
  });

  it('defaults severity to info', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('.rb');
    expect(el.classList).toContain('rb--info');
  });
});
