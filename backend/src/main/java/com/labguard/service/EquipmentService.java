package com.labguard.service;

import com.labguard.dto.EquipmentDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final ComputerRepository computerRepository;
    private final ComputerEquipmentRepository computerEquipmentRepository;
    private final IssueRepository issueRepository;
    private final MaintenanceRepository maintenanceRepository;
    private final AuditLogService auditLogService;

    public List<EquipmentDetailDto> getAllEquipment() {
        return equipmentRepository.findAll().stream()
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public EquipmentDetailDto getEquipmentDetail(UUID equipmentId) {
        Equipment equipment = equipmentRepository.findById(equipmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Equipment not found: " + equipmentId));
        return toDetailDto(equipment);
    }

    public EquipmentDetailDto getEquipmentByAssetId(String assetId) {
        Equipment equipment = equipmentRepository.findByAssetId(assetId)
            .orElseThrow(() -> new ResourceNotFoundException("Equipment asset not found: " + assetId));
        return toDetailDto(equipment);
    }

    public QrScanResultDto scanEquipmentQr(String assetId) {
        Equipment equipment = equipmentRepository.findByAssetId(assetId)
            .orElseThrow(() -> new ResourceNotFoundException("Equipment asset not found: " + assetId));

        String assignedLab = "Unassigned";
        String assignedPc = "Unassigned";

        List<ComputerEquipment> mappings = computerEquipmentRepository.findAll().stream()
            .filter(ce -> ce.getEquipment().getId().equals(equipment.getId()) && "ACTIVE".equalsIgnoreCase(ce.getStatus()))
            .toList();

        if (!mappings.isEmpty()) {
            Computer pc = mappings.get(0).getComputer();
            assignedPc = pc.getPcCode();
            assignedLab = pc.getLab().getCode();
        }

        List<Issue> issues = issueRepository.findAll().stream()
            .filter(i -> i.getEquipment() != null && i.getEquipment().getId().equals(equipment.getId()))
            .toList();

        String lastIssue = "None";
        if (!issues.isEmpty()) {
            lastIssue = issues.get(issues.size() - 1).getTitle() + " (" + issues.get(issues.size() - 1).getStatus() + ")";
        }

        long maintenanceCount = maintenanceRepository.findByEquipmentId(equipment.getId()).size();

        return QrScanResultDto.builder()
            .assetId(equipment.getAssetId())
            .type(equipment.getType())
            .brandModel(equipment.getBrand() + " " + (equipment.getModel() != null ? equipment.getModel() : ""))
            .assignedLab(assignedLab)
            .assignedPc(assignedPc)
            .currentStatus(equipment.getStatus())
            .issueCount(issues.size())
            .lastIssue(lastIssue)
            .maintenanceHistorySummary(maintenanceCount + " maintenance tickets logged")
            .build();
    }

    @Transactional
    public void assignEquipmentToPc(AssignEquipmentRequest request, User adminUser) {
        Computer computer = computerRepository.findById(request.getComputerId())
            .orElseThrow(() -> new ResourceNotFoundException("Computer not found: " + request.getComputerId()));
        Equipment equipment = equipmentRepository.findById(request.getEquipmentId())
            .orElseThrow(() -> new ResourceNotFoundException("Equipment not found: " + request.getEquipmentId()));

        // Deactivate previous active equipment in this slot
        Optional<ComputerEquipment> existingSlot = computerEquipmentRepository.findActiveByComputerIdAndSlotType(
            computer.getId(), request.getSlotType()
        );
        existingSlot.ifPresent(ce -> {
            ce.setStatus("REPLACED");
            ce.setUnassignedAt(OffsetDateTime.now());
            computerEquipmentRepository.save(ce);
        });

        ComputerEquipment newMapping = ComputerEquipment.builder()
            .computer(computer)
            .equipment(equipment)
            .slotType(request.getSlotType())
            .status("ACTIVE")
            .assignedAt(OffsetDateTime.now())
            .build();
        computerEquipmentRepository.save(newMapping);

        auditLogService.logAction(adminUser, "EQUIPMENT_ASSIGNED", "ComputerEquipment",
            newMapping.getId().toString(), computer.getLab().getId(),
            "Assigned " + equipment.getAssetId() + " (" + request.getSlotType() + ") to " + computer.getPcCode());
    }

    private EquipmentDetailDto toDetailDto(Equipment equipment) {
        UUID assignedPcId = null;
        String assignedPcCode = "NONE";
        String assignedLabCode = "NONE";

        List<ComputerEquipment> activeMappings = computerEquipmentRepository.findAll().stream()
            .filter(ce -> ce.getEquipment().getId().equals(equipment.getId()) && "ACTIVE".equalsIgnoreCase(ce.getStatus()))
            .toList();

        if (!activeMappings.isEmpty()) {
            Computer pc = activeMappings.get(0).getComputer();
            assignedPcId = pc.getId();
            assignedPcCode = pc.getPcCode();
            assignedLabCode = pc.getLab().getCode();
        }

        List<Issue> issues = issueRepository.findAll().stream()
            .filter(i -> i.getEquipment() != null && i.getEquipment().getId().equals(equipment.getId()))
            .toList();

        String lastIssueTitle = null;
        OffsetDateTime lastIssueDate = null;
        if (!issues.isEmpty()) {
            Issue last = issues.get(issues.size() - 1);
            lastIssueTitle = last.getTitle();
            lastIssueDate = last.getCreatedAt();
        }

        return EquipmentDetailDto.builder()
            .id(equipment.getId())
            .assetId(equipment.getAssetId())
            .type(equipment.getType())
            .brand(equipment.getBrand())
            .model(equipment.getModel())
            .serialNumber(equipment.getSerialNumber())
            .status(equipment.getStatus())
            .qrCodeData(equipment.getQrCodeData())
            .purchaseDate(equipment.getPurchaseDate())
            .warrantyUntil(equipment.getWarrantyUntil())
            .assignedPcId(assignedPcId)
            .assignedPcCode(assignedPcCode)
            .assignedLabCode(assignedLabCode)
            .totalIssueCount(issues.size())
            .lastIssueTitle(lastIssueTitle)
            .lastIssueDate(lastIssueDate)
            .build();
    }
}
