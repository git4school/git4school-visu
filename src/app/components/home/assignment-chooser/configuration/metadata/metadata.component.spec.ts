import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { Metadata } from "@models/Metadata.model";
import { MetadataComponent } from "./metadata.component";

describe("MetadataComponent change events", () => {
  let fixture: ComponentFixture<MetadataComponent>;
  let component: MetadataComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [MetadataComponent],
    }).overrideComponent(MetadataComponent, { set: { template: "" } });

    fixture = TestBed.createComponent(MetadataComponent);
    component = fixture.componentInstance;
    component.metadata = new Metadata();
    fixture.detectChanges();
  });

  it("emits textModified when a free-text field changes", () => {
    const spy = jasmine.createSpy("textModified");
    component.textModified.subscribe(spy);
    component.metadataForm.get("title").setValue("New title");
    component.metadataForm.get("course").setValue("New course");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("emits modified immediately when questions change", () => {
    const spy = jasmine.createSpy("modified");
    component.modified.subscribe(spy);
    component.metadataForm.get("questions").setValue(["Q1", "Q2"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("emits modified immediately when defaultSessionDuration changes", () => {
    const spy = jasmine.createSpy("modified");
    component.modified.subscribe(spy);
    component.metadataForm.get("defaultSessionDuration").setValue({ hour: 2, minute: 0, second: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("emits modified immediately when dates and closing mode change", () => {
    const spy = jasmine.createSpy("modified");
    component.modified.subscribe(spy);
    component.metadataForm.get("startDate").setValue(new Date());
    component.metadataForm.get("closingMode").setValue("custom");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
