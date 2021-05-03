import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
} from "@angular/core";
import { FormArray, FormBuilder, FormGroup } from "@angular/forms";
import { BaseEditConfigurationComponent } from "./base-edit-configuration.component";

@Component({
  template: "",
})
export abstract class BaseTabEditConfigurationComponent<Data>
  extends BaseEditConfigurationComponent<Data[]>
  implements OnInit, AfterContentChecked {
  @Input() datas: Data[];
  formGroup: FormGroup;
  nbEditing: number;

  constructor(protected fb: FormBuilder, protected cdref: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.initForm(this.datas);
  }

  ngAfterContentChecked(): void {
    this.cdref.detectChanges();
  }

  get getFormControls() {
    const controls = this.formGroup.get("formArray") as FormArray;
    return controls;
  }

  isEditable(group: FormGroup) {
    return group.get("isEditable").value;
  }

  initForm(datas: Data[]) {
    this.formGroup = this.fb.group({
      formArray: this.fb.array([]),
    });
    this.populateRows(datas);
    this.nbEditing = 0;
  }

  populateRows(datas: Data[]) {
    datas?.forEach((data) => {
      this.addRow(data);
    });
  }

  addRow(data?: Data) {
    const control = this.getFormControls;
    const group = this.createFormGroup(data);
    control.push(group);
    if (!data) {
      this.editRow(group);
    } else {
      group.disable();
    }
  }

  editRow(group: FormGroup) {
    this.saveRow(group);
    this.nbEditing++;
    group.get("isEditable").setValue(true);
    group.enable();
  }

  deleteRow(index: number) {
    const control = this.getFormControls;
    control.removeAt(index);
    this.modify();
  }

  validateRow(group: FormGroup) {
    if (group.valid) {
      this.nbEditing--;
      group.get("isEditable").setValue(false);
      group.disable();
      this.modify();
    } else {
      group.get("isInvalid").setValue(false);
      group.get("isInvalid").setValue(true);
    }
  }

  cancelRow(group: FormGroup, index: number) {
    this.restoreRow(group);
    this.nbEditing--;
    group.get("isEditable").setValue(false);
    group.disable();
  }

  saveRow(group: FormGroup) {
    group.get("save").setValue(group.value);
  }

  restoreRow(group: FormGroup) {
    group.setValue(group.get("save").value);
  }

  abstract createFormGroup(data?: Data);

  abstract submitForm(): void;
}
