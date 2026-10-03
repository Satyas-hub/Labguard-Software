package com.labguard.repository;

import com.labguard.entity.AcademicClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AcademicClassRepository extends JpaRepository<AcademicClass, UUID> {
    
    @Query("SELECT c FROM AcademicClass c WHERE c.faculty.user.id = :userId AND c.status = 'ACTIVE'")
    List<AcademicClass> findActiveClassesByFacultyUserId(@Param("userId") UUID userId);

    @Query("SELECT c FROM AcademicClass c WHERE c.faculty.id = :facultyId AND c.status = 'ACTIVE'")
    List<AcademicClass> findActiveClassesByFacultyId(@Param("facultyId") UUID facultyId);

    List<AcademicClass> findByDepartmentId(UUID departmentId);

    List<AcademicClass> findByStatus(String status);
}
