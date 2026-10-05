import { Component, forwardRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { Metadata } from "@models/Metadata.model";
import { SessionDurationPickerComponent } from "@shared/ui/session-duration-picker/session-duration-picker.component";
import { MetadataComponent } from "./metadata.component";

@Component({
  selector: "questions-chooser",
  template: "",
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MockQuestionsChooserComponent), multi: true }],
})
class MockQuestionsChooserComponent implements ControlValueAccessor {
  registerOnChange(fn: any) {
    this.onChange = fn;
  }
  registerOnTouched() {}
  writeValue() {}
  emit() {
    this.onChange(["Q1"]);
  }
  private onChange: (value: any) => void = () => {};
}

describe("MetadataComponent with real ControlValueAccessor children", () => {
  let fixture: ComponentFixture<MetadataComponent>;
  let component: MetadataComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [MetadataComponent, SessionDurationPickerComponent, MockQuestionsChooserComponent],
    }).overrideComponent(MetadataComponent, {
      set: {
        template: `<form [formGroup]="metadataForm">
          <questions-chooser formControlName="questions"></questions-chooser>
          <app-session-duration-picker formControlName="defaultSessionDuration"></app-session-duration-picker>
        </form>`,
      },
    });

    fixture = TestBed.createComponent(MetadataComponent);
    component = fixture.componentInstance;
    component.metadata = new Metadata();
    fixture.detectChanges();
  });

  it("emits modified when the questions CVA changes", () => {
    const spy = jasmine.createSpy("modified");
    component.modified.subscribe(spy);
    const mock = fixture.debugElement.query(By.directive(MockQuestionsChooserComponent)).componentInstance as MockQuestionsChooserComponent;
    mock.emit();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
    expect(component.metadataForm.get("questions").value).toEqual(["Q1"]);
  });

  it("emits modified when a duration preset is selected", () => {
    const spy = jasmine.createSpy("modified");
    component.modified.subscribe(spy);
    (fixture.nativeElement.querySelector(".dp-clock") as HTMLElement).click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
    expect(component.metadataForm.get("defaultSessionDuration").value).toEqual({ hour: 1, minute: 0, second: 0 });
  });
});
