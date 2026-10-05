import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { TranslateService } from "@ngx-translate/core";
import { Assignment } from "@models/Assignment.model";
import { Metadata } from "@models/Metadata.model";
import { DataService } from "@services/data.service";
import { ToastService } from "@services/toast.service";
import { ConfigurationComponent } from "./configuration.component";
import { MetadataComponent } from "./metadata/metadata.component";
import { EditRepositoriesComponent } from "./edit-repositories/edit-repositories.component";

describe("ConfigurationComponent autosave payload", () => {
  let fixture: ComponentFixture<ConfigurationComponent>;
  let component: ConfigurationComponent;
  let dataServiceSpy: jasmine.SpyObj<DataService>;

  beforeEach(() => {
    dataServiceSpy = jasmine.createSpyObj<DataService>("DataService", ["saveData"]);
    dataServiceSpy.saveData.and.callFake((assignment: Assignment) => Promise.resolve(assignment.id ?? 42));

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [ConfigurationComponent, MetadataComponent, EditRepositoriesComponent],
      providers: [
        { provide: DataService, useValue: dataServiceSpy },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: ToastService, useValue: { error: () => {}, success: () => {} } },
      ],
    })
      .overrideComponent(ConfigurationComponent, {
        set: {
          template: `<metadata #metadataComp [metadata]="assignment" (modified)="onImmediateModification()"
            (textModified)="onTextModification()" (textBlurred)="onTextBlur()"></metadata>`,
        },
      })
      .overrideComponent(MetadataComponent, { set: { template: "" } })
      .overrideComponent(EditRepositoriesComponent, { set: { template: "" } });

    fixture = TestBed.createComponent(ConfigurationComponent);
    component = fixture.componentInstance;
    component.assignment = new Assignment();
    component.assignment.id = 5;
    component.assignment.metadata = new Metadata();
    fixture.detectChanges();
  });

  it("persists questions and defaultSessionDuration when they change", fakeAsync(() => {
    const metadataComp = component.metadataComp;
    metadataComp.metadataForm.get("questions").setValue(["Q1", "Q2"]);
    metadataComp.metadataForm.get("defaultSessionDuration").setValue({ hour: 2, minute: 15, second: 0 });
    tick();

    // The very first save must already contain the new values (guards against reading a stale
    // FormGroup.value before the parent recomputes it).
    const firstSaved = dataServiceSpy.saveData.calls.first().args[0] as Assignment;
    expect(firstSaved.metadata.questions).toEqual(["Q1", "Q2"]);

    const saved = dataServiceSpy.saveData.calls.mostRecent().args[0] as Assignment;
    expect(saved.metadata.defaultSessionDuration).toEqual({ hour: 2, minute: 15, second: 0 });
  }));
});
