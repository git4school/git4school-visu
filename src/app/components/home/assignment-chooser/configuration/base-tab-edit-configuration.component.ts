import { ChangeDetectorRef, Component, Input, OnInit } from "@angular/core";
import { UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";
import { BaseEditConfigurationComponent } from "./base-edit-configuration.component";

@Component({
  template: "",
})
export abstract class BaseTabEditConfigurationComponent<Data> extends BaseEditConfigurationComponent implements OnInit {
  @Input() datas: Data[];
  formGroups: UntypedFormGroup[];

  constructor(protected fb: UntypedFormBuilder, protected cdref: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.initForm(this.datas);
  }

  get getFormControls() {
    const controls = this.formGroups;
    return controls;
  }

  isEditable(group: UntypedFormGroup) {
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

  editRow(group: UntypedFormGroup) {
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
  }

  validateRow(group: UntypedFormGroup) {
    if (group.valid) {
      group.get("isEditable").setValue(false);
      group.disable();
      this.modify();
    } else {
      group.get("isInvalid").setValue(false);
      group.get("isInvalid").setValue(true);
    }
  }

  cancelRow(group: UntypedFormGroup, _index: number) {
    this.restoreRow(group);
    group.get("isEditable").setValue(false);
    group.disable();
  }

  saveRow(group: UntypedFormGroup) {
    group.get("save").setValue(group.value);
  }

  restoreRow(group: UntypedFormGroup) {
    group.setValue(group.get("save").value);
    group.markAsPristine();
  }

  protected abstract createFormGroup(data?: Data);
}
