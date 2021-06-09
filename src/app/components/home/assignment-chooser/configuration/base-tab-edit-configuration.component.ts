import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
} from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { BaseEditConfigurationComponent } from "./base-edit-configuration.component";

@Component({
  template: "",
})
export abstract class BaseTabEditConfigurationComponent<Data>
  extends BaseEditConfigurationComponent<Data[]>
  implements OnInit, AfterContentChecked {
  @Input() datas: Data[];
  formGroups: FormGroup[];

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
    const controls = this.formGroups;
    return controls;
  }

  isEditable(group: FormGroup) {
    return group.get("isEditable").value;
  }

  initForm(datas: Data[]) {
    this.formGroups = [];
    this.populateRows(datas);
  }

  populateRows(datas: Data[]) {
    datas?.forEach((data) => {
      this.addRow(data);
    });
  }

  addRow(data?: Data) {
    const controls = this.getFormControls;
    const group = this.createFormGroup(data);
    controls.push(group);
    if (!data) {
      this.editRow(group);
    } else {
      group.disable();
    }
  }

  editRow(group: FormGroup) {
    this.saveRow(group);
    group.get("isEditable").setValue(true);
    group.enable();
  }

  removeRow(index: number) {
    const controls = this.getFormControls;
    controls.splice(index, 1);
  }

  deleteRow(index: number) {
    this.removeRow(index);
    this.modify();
    this.submitForm();
  }

  validateRow(group: FormGroup) {
    if (group.valid) {
      group.get("isEditable").setValue(false);
      group.disable();
      this.modify();
      this.submitForm();
    } else {
      group.get("isInvalid").setValue(false);
      group.get("isInvalid").setValue(true);
    }
  }

  cancelRow(group: FormGroup, index: number) {
    this.restoreRow(group);
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
